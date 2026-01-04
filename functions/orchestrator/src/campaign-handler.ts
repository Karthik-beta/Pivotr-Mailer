/**
 * Campaign Handler
 * 
 * Manages the execution of a campaign with:
 * - Fill Buffer pipeline (pre-verify next lead during delay)
 * - Gaussian delay timing
 * - Campaign lock management
 * - Graceful pause/abort handling
 */

import type { Client } from 'node-appwrite';
import type { Campaign } from '../../../shared/types/campaign.types';
import type { Lead } from '../../../shared/types/lead.types';
import type { Settings } from '../../../shared/types/settings.types';
import { CampaignStatus, LeadStatus } from '../../../shared/constants/status.constants';
import { EventType } from '../../../shared/constants/event.constants';
import { SENDING_TIMEOUT_MS } from '../../../shared/constants/collection.constants';

// Local modules
import { calculateGaussianDelay, sleep } from './delay-calculator';
import { processLead, type ProcessConfig } from './lead-processor';

// Shared modules
import { withCampaignLock } from '../../_shared/locking/campaign-lock';
import {
    getCampaignById,
    updateCampaign,
    completeCampaign
} from '../../_shared/database/repositories/campaign.repository';
import {
    getNextQueuedLead,
    getSendingLeads,
    updateLead,
    countRemainingLeads
} from '../../_shared/database/repositories/lead.repository';
import { logInfo, logWarn, logError } from '../../_shared/database/repositories/log.repository';
import { getSettings } from '../../_shared/database/repositories/settings.repository';

/**
 * Campaign execution result
 */
export interface CampaignExecutionResult {
    campaignId: string;
    status: 'completed' | 'paused' | 'aborted' | 'error' | 'locked';
    leadsProcessed: number;
    leadsSkipped: number;
    leadsErrored: number;
    message: string;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
    appwriteClient: Client;
    appwriteEndpoint: string;
    unsubscribeFunctionId: string;
}

/**
 * Execute a campaign with the Fill Buffer pipeline.
 */
export async function executeCampaign(
    campaignId: string,
    config: OrchestratorConfig
): Promise<CampaignExecutionResult> {
    const { appwriteClient } = config;

    try {
        // Acquire campaign lock
        return await withCampaignLock(appwriteClient, campaignId, async () => {
            return await runCampaignWithLock(campaignId, config);
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a lock error
        if (errorMessage.includes('lock')) {
            return {
                campaignId,
                status: 'locked',
                leadsProcessed: 0,
                leadsSkipped: 0,
                leadsErrored: 0,
                message: `Campaign is locked by another instance: ${errorMessage}`,
            };
        }

        await logError(appwriteClient, EventType.CAMPAIGN_ERROR,
            `Failed to execute campaign ${campaignId}: ${errorMessage}`, {
            campaignId,
            errorDetails: { message: errorMessage },
        }
        );

        return {
            campaignId,
            status: 'error',
            leadsProcessed: 0,
            leadsSkipped: 0,
            leadsErrored: 0,
            message: errorMessage,
        };
    }
}

/**
 * Run campaign execution with lock already acquired.
 */
async function runCampaignWithLock(
    campaignId: string,
    config: OrchestratorConfig
): Promise<CampaignExecutionResult> {
    const { appwriteClient } = config;

    // Get campaign
    const campaign = await getCampaignById(appwriteClient, campaignId);
    if (!campaign) {
        return {
            campaignId,
            status: 'error',
            leadsProcessed: 0,
            leadsSkipped: 0,
            leadsErrored: 0,
            message: 'Campaign not found',
        };
    }

    // Get settings
    const settings = await getSettings(appwriteClient);
    if (!settings) {
        return {
            campaignId,
            status: 'error',
            leadsProcessed: 0,
            leadsSkipped: 0,
            leadsErrored: 0,
            message: 'Settings not configured',
        };
    }

    // Recover any stuck SENDING leads
    await recoverStuckLeads(appwriteClient, campaignId);

    // Mark campaign as RUNNING
    await updateCampaign(appwriteClient, campaignId, {
        status: CampaignStatus.RUNNING,
    });

    await logInfo(appwriteClient, EventType.CAMPAIGN_STARTED,
        `Starting campaign: ${campaign.name}`, { campaignId }
    );

    let leadsProcessed = 0;
    let leadsSkipped = 0;
    let leadsErrored = 0;

    // Fill Buffer: Pre-verified lead ready for next iteration
    let verifiedBuffer: Lead | null = null;

    // Main processing loop
    while (true) {
        // Check for pause/abort
        const currentCampaign = await getCampaignById(appwriteClient, campaignId);
        if (!currentCampaign) break;

        if (currentCampaign.status === CampaignStatus.PAUSED) {
            await logInfo(appwriteClient, EventType.CAMPAIGN_PAUSED,
                'Campaign paused by user', { campaignId }
            );
            return {
                campaignId,
                status: 'paused',
                leadsProcessed,
                leadsSkipped,
                leadsErrored,
                message: 'Campaign paused',
            };
        }

        if (currentCampaign.status === CampaignStatus.ABORTING) {
            await updateCampaign(appwriteClient, campaignId, {
                status: CampaignStatus.ABORTED,
            });
            await logInfo(appwriteClient, EventType.CAMPAIGN_ABORTED,
                'Campaign aborted by user', { campaignId }
            );
            return {
                campaignId,
                status: 'aborted',
                leadsProcessed,
                leadsSkipped,
                leadsErrored,
                message: 'Campaign aborted',
            };
        }

        // Get next lead (from buffer or queue)
        let currentLead: Lead | null = verifiedBuffer;
        verifiedBuffer = null;

        if (!currentLead) {
            currentLead = await getNextQueuedLead(appwriteClient, campaignId);
        }

        if (!currentLead) {
            // No more leads to process
            await completeCampaign(appwriteClient, campaignId);
            await logInfo(appwriteClient, EventType.CAMPAIGN_COMPLETED,
                `Campaign completed: ${leadsProcessed} sent, ${leadsSkipped} skipped, ${leadsErrored} errors`,
                { campaignId }
            );
            return {
                campaignId,
                status: 'completed',
                leadsProcessed,
                leadsSkipped,
                leadsErrored,
                message: 'All leads processed',
            };
        }

        // Process the current lead
        const processConfig: ProcessConfig = {
            appwriteClient,
            campaign: currentCampaign,
            settings,
            appwriteEndpoint: config.appwriteEndpoint,
            unsubscribeFunctionId: config.unsubscribeFunctionId,
        };

        const result = await processLead(currentLead, processConfig);

        // Update counters
        if (result.success) {
            leadsProcessed++;
        } else if (result.status === LeadStatus.INVALID || result.status === LeadStatus.RISKY) {
            leadsSkipped++;
        } else {
            leadsErrored++;
        }

        // Check if more leads remain
        const remainingLeads = await countRemainingLeads(appwriteClient, campaignId);
        if (remainingLeads === 0) {
            await completeCampaign(appwriteClient, campaignId);
            await logInfo(appwriteClient, EventType.CAMPAIGN_COMPLETED,
                `Campaign completed: ${leadsProcessed} sent, ${leadsSkipped} skipped, ${leadsErrored} errors`,
                { campaignId }
            );
            return {
                campaignId,
                status: 'completed',
                leadsProcessed,
                leadsSkipped,
                leadsErrored,
                message: 'All leads processed',
            };
        }

        // Calculate Gaussian delay
        const delayMs = calculateGaussianDelay({
            minDelayMs: currentCampaign.minDelayMs,
            maxDelayMs: currentCampaign.maxDelayMs,
            mean: currentCampaign.gaussianMean ?? undefined,
            stdDev: currentCampaign.gaussianStdDev ?? undefined,
        });

        // Fill Buffer: Pre-verify next lead during delay
        const fillBufferPromise = fillVerifiedBuffer(
            appwriteClient,
            campaignId,
            currentCampaign,
            settings,
            processConfig
        );

        // Wait for delay while filling buffer
        const [bufferResult] = await Promise.all([
            fillBufferPromise,
            sleep(delayMs),
        ]);

        verifiedBuffer = bufferResult;
    }

    return {
        campaignId,
        status: 'completed',
        leadsProcessed,
        leadsSkipped,
        leadsErrored,
        message: 'Campaign loop ended unexpectedly',
    };
}

/**
 * Fill Buffer Strategy: Find and pre-verify the next valid lead.
 * Keeps trying until it finds a valid lead or runs out of queue.
 */
async function fillVerifiedBuffer(
    client: Client,
    campaignId: string,
    campaign: Campaign,
    settings: Settings,
    _processConfig: ProcessConfig
): Promise<Lead | null> {
    const maxAttempts = 5; // Prevent infinite loop

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const nextLead = await getNextQueuedLead(client, campaignId);
        if (!nextLead) return null;

        // Try to verify (we just want to see if it's valid)
        const verifierConfig = {
            apiKey: settings.myEmailVerifierApiKey,
            timeoutMs: settings.verifierTimeoutMs,
            maxRetries: 1, // Single attempt for buffer fill
            retryBackoffMs: settings.retryBackoffMs,
        };

        try {
            const { verifyEmail } = await import('../../_shared/email-verifier/client');
            const result = await verifyEmail(nextLead.email, verifierConfig);

            if (result.isValid || (result.status === 'catch_all' && campaign.allowCatchAll)) {
                // Valid lead found, cache the verification result
                await updateLead(client, nextLead.$id, {
                    verificationResult: result.status,
                    verificationTimestamp: new Date().toISOString(),
                });
                return nextLead;
            } else {
                // Invalid lead, mark and continue searching
                await updateLead(client, nextLead.$id, {
                    status: result.status === 'catch_all' ? LeadStatus.RISKY : LeadStatus.INVALID,
                    verificationResult: result.status,
                    verificationTimestamp: new Date().toISOString(),
                });
                // Continue to next lead in buffer fill
            }
        } catch {
            // Verification failed, leave lead in queue for main loop
            return null;
        }
    }

    return null;
}

/**
 * Recover leads stuck in SENDING status (power failure recovery).
 */
async function recoverStuckLeads(
    client: Client,
    campaignId: string
): Promise<void> {
    const stuckLeads = await getSendingLeads(client, campaignId, SENDING_TIMEOUT_MS);

    for (const lead of stuckLeads) {
        if (lead.sesMessageId) {
            // SES accepted the message but status update failed
            await updateLead(client, lead.$id, {
                status: LeadStatus.SENT,
                processedAt: new Date().toISOString(),
            });
            await logWarn(client, EventType.SYSTEM_RECOVERY,
                `Recovered stuck lead ${lead.$id} as SENT (had messageId)`,
                { leadId: lead.$id, campaignId }
            );
        } else {
            // SES call may not have completed, revert to VERIFIED for retry
            await updateLead(client, lead.$id, {
                status: LeadStatus.VERIFIED,
                processingStartedAt: null,
            });
            await logWarn(client, EventType.SYSTEM_RECOVERY,
                `Recovered stuck lead ${lead.$id} back to VERIFIED for retry`,
                { leadId: lead.$id, campaignId }
            );
        }
    }

    if (stuckLeads.length > 0) {
        await logInfo(client, EventType.SYSTEM_RECOVERY,
            `Recovered ${stuckLeads.length} stuck leads`, { campaignId }
        );
    }
}
