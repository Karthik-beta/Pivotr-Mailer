/**
 * SQS Poller Function — Main Entry Point
 * 
 * This Appwrite Function runs on a schedule (CRON: */1 * * * *)
 * to poll AWS SQS for bounce and complaint notifications from SES.
 * 
 * When a bounce or complaint is received:
 * 1. Find the lead by sesMessageId
    * 2. Update lead status(BOUNCED or COMPLAINED)
        * 3. Increment metrics
            * 4. Delete message from SQS
                */

import { Client } from 'node-appwrite';
import { LeadStatus } from '../../../shared/constants/status.constants';
import { EventType } from '../../../shared/constants/event.constants';

// Shared modules
import { pollMessages, deleteMessage, type SesNotification } from '../../_shared/sqs-client/client';
import { findLeadBySesMessageId, updateLead } from '../../_shared/database/repositories/lead.repository';
import { logInfo, logWarn, logError } from '../../_shared/database/repositories/log.repository';
import { incrementGlobalMetrics, incrementCampaignMetrics } from '../../_shared/database/repositories/metrics.repository';
import { getSqsConfig } from '../../_shared/database/repositories/settings.repository';

/**
 * Appwrite Function context
 */
interface AppwriteContext {
    req: {
        body: string;
        headers: Record<string, string>;
        method: string;
    };
    res: {
        json: (data: unknown, statusCode?: number) => unknown;
        text: (data: string, statusCode?: number) => unknown;
    };
    log: (message: string) => void;
    error: (message: string) => void;
}

/**
 * Main entry point for the SQS Poller Function.
 */
export default async function main(context: AppwriteContext): Promise<unknown> {
    const { res, log, error: logErr } = context;

    // Initialize Appwrite client
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || '')
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
        .setKey(process.env.APPWRITE_API_KEY || '');

    try {
        // Get SQS configuration
        const sqsConfig = await getSqsConfig(client);

        // Poll SQS queue
        log('Polling SQS queue for notifications...');
        const notifications = await pollMessages(sqsConfig);

        if (notifications.length === 0) {
            log('No notifications to process');
            return res.json({ success: true, message: 'No notifications', processed: 0 });
        }

        log(`Processing ${notifications.length} notification(s)`);

        let processed = 0;
        let errors = 0;

        for (const notification of notifications) {
            try {
                await processNotification(client, notification, sqsConfig);
                processed++;
            } catch (err) {
                errors++;
                const message = err instanceof Error ? err.message : String(err);
                logErr(`Failed to process notification: ${message}`);

                await logError(client, EventType.SYSTEM_ERROR,
                    `Failed to process SQS notification: ${message}`, {
                    sqsMessage: notification.rawMessage,
                }
                );
            }
        }

        await logInfo(client, EventType.SYSTEM_STARTUP,
            `SQS poll complete: ${processed} processed, ${errors} errors`, {});

        return res.json({
            success: true,
            message: `Processed ${processed} notifications`,
            data: { processed, errors },
        });

    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`SQS Poller error: ${message}`);

        await logError(client, EventType.SYSTEM_ERROR, `SQS Poller error: ${message}`, {});

        return res.json({ success: false, message }, 500);
    }
}

/**
 * Process a single SQS notification.
 */
async function processNotification(
    client: Client,
    notification: SesNotification,
    sqsConfig: Awaited<ReturnType<typeof getSqsConfig>>
): Promise<void> {
    const { notificationType, messageId, recipient } = notification;

    // Ignore delivery notifications (we only care about bounces/complaints)
    if (notificationType === 'Delivery') {
        await deleteMessage(notification.receiptHandle, sqsConfig);
        return;
    }

    // Find lead by SES message ID
    const lead = await findLeadBySesMessageId(client, messageId);

    if (!lead) {
        // Log warning but still delete message to prevent reprocessing
        await logWarn(client, EventType.SYSTEM_ERROR,
            `SQS notification for unknown messageId: ${messageId}`, {
            sqsMessage: notification.rawMessage,
        }
        );
        await deleteMessage(notification.receiptHandle, sqsConfig);
        return;
    }

    // Process based on notification type
    if (notificationType === 'Bounce') {
        await handleBounce(client, lead.$id, lead.campaignId, notification);
    } else if (notificationType === 'Complaint') {
        await handleComplaint(client, lead.$id, lead.campaignId, notification);
    }

    // Delete message from SQS
    await deleteMessage(notification.receiptHandle, sqsConfig);
}

/**
 * Handle a bounce notification.
 */
async function handleBounce(
    client: Client,
    leadId: string,
    campaignId: string | null,
    notification: SesNotification
): Promise<void> {
    const { bounceType, bounceSubType, recipient } = notification;

    // Update lead status
    await updateLead(client, leadId, {
        status: LeadStatus.BOUNCED,
        bounceType: bounceType || null,
        bounceSubType: bounceSubType || null,
    });

    await logWarn(client, EventType.BOUNCE_RECEIVED,
        `Bounce received for ${recipient}: ${bounceType}/${bounceSubType}`, {
        leadId,
        campaignId: campaignId || undefined,
        sqsMessage: notification.rawMessage,
    }
    );

    // Update metrics
    const isHardBounce = bounceType === 'Permanent';

    await incrementGlobalMetrics(client, {
        totalBounces: 1,
        totalHardBounces: isHardBounce ? 1 : 0,
        totalSoftBounces: isHardBounce ? 0 : 1,
    });

    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, {
            totalBounces: 1,
            totalHardBounces: isHardBounce ? 1 : 0,
            totalSoftBounces: isHardBounce ? 0 : 1,
        });
    }
}

/**
 * Handle a complaint notification.
 */
async function handleComplaint(
    client: Client,
    leadId: string,
    campaignId: string | null,
    notification: SesNotification
): Promise<void> {
    const { complaintFeedbackType, recipient } = notification;

    // Update lead status
    await updateLead(client, leadId, {
        status: LeadStatus.COMPLAINED,
        complaintFeedbackType: complaintFeedbackType || null,
    });

    await logError(client, EventType.COMPLAINT_RECEIVED,
        `Complaint received for ${recipient}: ${complaintFeedbackType || 'unknown'}`, {
        leadId,
        campaignId: campaignId || undefined,
        sqsMessage: notification.rawMessage,
    }
    );

    // Update metrics
    await incrementGlobalMetrics(client, { totalComplaints: 1 });

    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, { totalComplaints: 1 });
    }
}
