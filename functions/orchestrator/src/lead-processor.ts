/**
 * Lead Processor
 *
 * Handles the processing of individual leads through the email pipeline:
 * 1. Parse name (if not already parsed)
 * 2. Verify email (JIT verification)
 * 3. Resolve template (Spintax + variables)
 * 4. Send via SES
 * 5. Update lead status and metrics
 */

import type { Client } from 'node-appwrite';
import { EventType } from '../../../shared/constants/event.constants';
import { LeadStatus, VerificationResult } from '../../../shared/constants/status.constants';
import type { Campaign } from '../../../shared/types/campaign.types';
import type { Lead } from '../../../shared/types/lead.types';
import type { Settings } from '../../../shared/types/settings.types';
import { incrementCampaignCounter } from '../../_shared/database/repositories/campaign.repository';
// Repositories
import { getLeadById, updateLead } from '../../_shared/database/repositories/lead.repository';
import { logError, logInfo, logWarn } from '../../_shared/database/repositories/log.repository';
import type { LogCreateInput } from '../../../shared/types/log.types';
import {
	incrementCampaignMetrics,
	incrementGlobalMetrics,
} from '../../_shared/database/repositories/metrics.repository';
import { verifyEmail } from '../../_shared/email-verifier/client';
// Shared modules
import { parseIndianName } from '../../_shared/name-parser/parser';
import { sendEmail } from '../../_shared/ses-client/client';
import { resolveSpintax } from '../../_shared/spintax/resolver';
import {
	buildTemplateVariables,
	generateUnsubscribeLink,
	injectVariables,
	templateVariablesToMap,
} from '../../_shared/spintax/variable-injector';

/**
 * Result of processing a lead
 */
export interface ProcessResult {
	success: boolean;
	leadId: string;
	status: string;
	messageId?: string;
	error?: string;
	processingTimeMs: number;
}

/**
 * Configuration for lead processing
 */
export interface ProcessConfig {
	appwriteClient: Client;
	campaign: Campaign;
	settings: Settings;
	appwriteEndpoint: string;
	unsubscribeFunctionId: string;
}

/**
 * Process a single lead through the email pipeline.
 */
export async function processLead(lead: Lead, config: ProcessConfig): Promise<ProcessResult> {
	const startTime = Date.now();
	const { appwriteClient, campaign, settings } = config;

	// Wide Event Context
	const context: Partial<LogCreateInput> = {
		leadId: lead.$id,
		campaignId: campaign.$id,
		metadata: {},
	};

	try {
		// Step 1: Mark as VERIFYING and record start time
		await updateLead(appwriteClient, lead.$id, {
			status: LeadStatus.VERIFYING,
			processingStartedAt: new Date().toISOString(),
		});

		// Step 2: Parse name if not already done
		let firstName = lead.parsedFirstName;
		if (!firstName) {
			const parsed = parseIndianName(lead.fullName);
			firstName = parsed.firstName || lead.fullName.split(' ')[0] || 'there';

			await updateLead(appwriteClient, lead.$id, {
				parsedFirstName: firstName,
			});
		}

		// Step 3: Verify email
		const verifierConfig = {
			apiKey: settings.myEmailVerifierApiKey,
			timeoutMs: settings.verifierTimeoutMs,
			maxRetries: settings.maxRetries,
			retryBackoffMs: settings.retryBackoffMs,
		};

		const verificationResult = await verifyEmail(lead.email, verifierConfig);
		context.verifierResponse = verificationResult.rawResponse as unknown as Record<string, unknown>;

		// Update metadata with verification context
		context.metadata = {
			...context.metadata,
			verification: {
				status: verificationResult.status,
				diagnosis: verificationResult.diagnosis,
				isValid: verificationResult.isValid,
				isGreylisted: verificationResult.isGreylisted,
			}
		};

		// Increment verifier credits used
		await incrementGlobalMetrics(appwriteClient, { verifierCreditsUsed: 1 });
		await incrementCampaignMetrics(appwriteClient, campaign.$id, { verifierCreditsUsed: 1 });

		// Handle verification result
		if (!verificationResult.isValid) {
			// Check for GREYLISTED (retry later)
			if (verificationResult.isGreylisted) {
				await updateLead(appwriteClient, lead.$id, {
					status: LeadStatus.RISKY,
					verificationResult: verificationResult.status,
					verificationTimestamp: new Date().toISOString(),
					errorMessage: `Greylisted - retry after ${verificationResult.retryAfterHours || 6} hours. ${verificationResult.diagnosis}`,
				});

				await incrementCampaignCounter(appwriteClient, campaign.$id, 'skippedCount');
				await incrementGlobalMetrics(appwriteClient, { totalVerificationFailed: 1 });

				await logWarn(
					appwriteClient,
					EventType.VERIFICATION_RISKY,
					`Domain greylisted for ${lead.email}, retry after ${verificationResult.retryAfterHours || 6} hours`,
					{
						...context,
						processingTimeMs: Date.now() - startTime,
					}
				);

				return {
					success: false,
					leadId: lead.$id,
					status: LeadStatus.RISKY,
					error: `Greylisted - retry later`,
					processingTimeMs: Date.now() - startTime,
				};
			}

			// Check if it's a RISKY (catch-all) email
			if (verificationResult.status === VerificationResult.CATCH_ALL) {
				if (campaign.allowCatchAll) {
					// Proceed with risky email
					// We'll log this as part of the final wide event, but maybe keep a WARN if it's significant?
					// The guidelines say "Emit one comprehensive event at the end of each operation".
					// So let's just make sure it's in the metadata.
				} else {
					// Skip risky email
					await updateLead(appwriteClient, lead.$id, {
						status: LeadStatus.RISKY,
						verificationResult: verificationResult.status,
						verificationTimestamp: new Date().toISOString(),
					});

					await incrementCampaignCounter(appwriteClient, campaign.$id, 'skippedCount');
					await incrementGlobalMetrics(appwriteClient, { totalVerificationFailed: 1 });

					await logWarn(
						appwriteClient,
						EventType.VERIFICATION_FAILED,
						`Catch-all domain detected for ${lead.email}, skipped`,
						{
							...context,
							processingTimeMs: Date.now() - startTime,
						}
					);

					return {
						success: false,
						leadId: lead.$id,
						status: LeadStatus.RISKY,
						error: 'Catch-all domain - skipped',
						processingTimeMs: Date.now() - startTime,
					};
				}
			} else {
				// Invalid email
				await updateLead(appwriteClient, lead.$id, {
					status: LeadStatus.INVALID,
					verificationResult: verificationResult.status,
					verificationTimestamp: new Date().toISOString(),
					errorMessage: verificationResult.errorMessage || verificationResult.diagnosis,
				});

				await incrementCampaignCounter(appwriteClient, campaign.$id, 'skippedCount');
				await incrementGlobalMetrics(appwriteClient, { totalVerificationFailed: 1 });

				await logWarn(
					appwriteClient,
					EventType.VERIFICATION_FAILED,
					`Email ${lead.email} failed verification: ${verificationResult.status}`,
					{
						...context,
						processingTimeMs: Date.now() - startTime,
					}
				);

				return {
					success: false,
					leadId: lead.$id,
					status: LeadStatus.INVALID,
					error: `Verification failed: ${verificationResult.status}`,
					processingTimeMs: Date.now() - startTime,
				};
			}
		}

		// Step 4: Mark as VERIFIED
		await updateLead(appwriteClient, lead.$id, {
			status: LeadStatus.VERIFIED,
			verificationResult: verificationResult.status,
			verificationTimestamp: new Date().toISOString(),
		});

		await incrementGlobalMetrics(appwriteClient, { totalVerificationPassed: 1 });

		// Step 5: Resolve template
		const unsubscribeLink = generateUnsubscribeLink(
			config.appwriteEndpoint,
			config.unsubscribeFunctionId,
			lead.$id,
			settings.unsubscribeTokenSecret
		);

		// Refresh lead with parsed name
		const updatedLead = await getLeadById(appwriteClient, lead.$id);
		if (!updatedLead) throw new Error('Lead not found after update');

		const templateVars = buildTemplateVariables(updatedLead, unsubscribeLink);
		const varMap = templateVariablesToMap(templateVars);

		const resolvedSubject = injectVariables(resolveSpintax(campaign.subjectTemplate), varMap);
		const resolvedBody = injectVariables(resolveSpintax(campaign.bodyTemplate), varMap);

		context.resolvedSubject = resolvedSubject;
		context.resolvedBody = resolvedBody;
		context.templateVariables = templateVars;

		// Step 6: Mark as SENDING
		await updateLead(appwriteClient, lead.$id, {
			status: LeadStatus.SENDING,
		});

		// Step 7: Send via SES
		const sesConfig = {
			region: settings.awsSesRegion,
			accessKeyId: settings.awsSesAccessKeyId,
			secretAccessKey: settings.awsSesSecretAccessKey,
			timeoutMs: settings.sesTimeoutMs,
			maxRetries: settings.maxRetries,
			retryBackoffMs: settings.retryBackoffMs,
		};

		const sendResult = await sendEmail(
			{
				to: lead.email,
				from: campaign.senderEmail,
				fromName: campaign.senderName,
				subject: resolvedSubject,
				bodyText: resolvedBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
				bodyHtml: resolvedBody,
				campaignId: campaign.$id,
				leadId: lead.$id,
			},
			sesConfig
		);

		context.sesResponse = sendResult.rawResponse as Record<string, unknown>;

		if (!sendResult.success) {
			// Send failed
			await updateLead(appwriteClient, lead.$id, {
				status: LeadStatus.ERROR,
				errorMessage: sendResult.errorMessage,
				processedAt: new Date().toISOString(),
			});

			await incrementCampaignCounter(appwriteClient, campaign.$id, 'errorCount');
			await incrementGlobalMetrics(appwriteClient, { totalErrors: 1 });

			await logError(
				appwriteClient,
				EventType.EMAIL_FAILED,
				`Failed to send email to ${lead.email}: ${sendResult.errorMessage}`,
				{
					...context,
					processingTimeMs: Date.now() - startTime,
				}
			);

			return {
				success: false,
				leadId: lead.$id,
				status: LeadStatus.ERROR,
				error: sendResult.errorMessage,
				processingTimeMs: Date.now() - startTime,
			};
		}

		// Step 8: Mark as SENT
		await updateLead(appwriteClient, lead.$id, {
			status: LeadStatus.SENT,
			sesMessageId: sendResult.messageId,
			processedAt: new Date().toISOString(),
		});

		// Step 9: Update metrics synchronously
		await incrementCampaignCounter(appwriteClient, campaign.$id, 'processedCount');
		await incrementGlobalMetrics(appwriteClient, { totalEmailsSent: 1 });
		await incrementCampaignMetrics(appwriteClient, campaign.$id, { totalEmailsSent: 1 });

		// Final Wide Event for Success
		await logInfo(appwriteClient, EventType.EMAIL_SENT, `Email sent to ${lead.email}`, {
			...context,
			processingTimeMs: Date.now() - startTime,
		});

		return {
			success: true,
			leadId: lead.$id,
			status: LeadStatus.SENT,
			messageId: sendResult.messageId,
			processingTimeMs: Date.now() - startTime,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		await updateLead(appwriteClient, lead.$id, {
			status: LeadStatus.ERROR,
			errorMessage,
			processedAt: new Date().toISOString(),
		});

		await incrementCampaignCounter(appwriteClient, campaign.$id, 'errorCount');
		await incrementGlobalMetrics(appwriteClient, { totalErrors: 1 });

		await logError(
			appwriteClient,
			EventType.SYSTEM_ERROR,
			`Error processing lead ${lead.$id}: ${errorMessage}`,
			{
				...context,
				processingTimeMs: Date.now() - startTime,
				errorDetails: {
					message: errorMessage,
					stack: error instanceof Error ? error.stack : undefined,
				},
			}
		);

		return {
			success: false,
			leadId: lead.$id,
			status: LeadStatus.ERROR,
			error: errorMessage,
			processingTimeMs: Date.now() - startTime,
		};
	}
}
