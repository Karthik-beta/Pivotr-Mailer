/**
 * SQS Poller Function — Main Entry Point
 * 
 * This Appwrite Function runs on a schedule (every 1 minute)
 * to poll AWS SQS for ALL SES event notifications via SNS.
 * 
 * Handles all 10 SES event types:
 * - Send, Delivery, Bounce, Complaint, Reject
 * - DeliveryDelay, Open, Click, Subscription, Rendering Failure
 * 
 * Each event is:
 * 1. Logged to the audit trail
 * 2. Used to update lead status (if applicable)
 * 3. Used to increment metrics
 * 4. Deleted from SQS after processing
 */

import { Client } from 'node-appwrite';
import { EventType } from './lib/shared/constants/event.constants';
import { LeadStatus } from './lib/shared/constants/status.constants';
import { findLeadBySesMessageId, updateLead } from './lib/shared/database/repositories/lead.repository';
import { logError, logInfo, logWarn } from './lib/shared/database/repositories/log.repository';
import { incrementCampaignMetrics, incrementGlobalMetrics } from './lib/shared/database/repositories/metrics.repository';
import { getSqsConfig } from './lib/shared/database/repositories/settings.repository';
import { deleteMessage, pollMessages, type SesNotification } from './lib/shared/sqs-client/client';

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

    // Get endpoint - fix localhost for Docker internal networking
    let endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || '';
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
        endpoint = endpoint.replace('localhost', 'appwrite').replace('127.0.0.1', 'appwrite');
    }

    // Initialize Appwrite client
    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
        .setKey(process.env.APPWRITE_API_KEY || '')
        .setSelfSigned(true);

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
                await processNotification(client, notification, sqsConfig, log);
                processed++;
            } catch (err) {
                errors++;
                const message = err instanceof Error ? err.message : String(err);
                logErr(`Failed to process notification: ${message}`);

                await logError(client, EventType.SYSTEM_ERROR,
                    `Failed to process SQS notification: ${message}`, {
                    sqsMessage: notification.rawMessage,
                });
            }
        }

        await logInfo(client, EventType.SYSTEM_RECOVERY,
            `SQS poll complete: ${processed} processed, ${errors} errors`, {
            metadata: { processed, errors }
        });

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
 * Process a single SQS notification based on its type.
 */
async function processNotification(
    client: Client,
    notification: SesNotification,
    sqsConfig: Awaited<ReturnType<typeof getSqsConfig>>,
    log: (msg: string) => void
): Promise<void> {
    const { notificationType, messageId } = notification;

    log(`Processing ${notificationType} event for messageId: ${messageId}`);

    // Route to appropriate handler based on event type
    switch (notificationType) {
        case 'Send':
            await handleSend(client, notification);
            break;

        case 'Delivery':
            await handleDelivery(client, notification);
            break;

        case 'Bounce':
            await handleBounce(client, notification);
            break;

        case 'Complaint':
            await handleComplaint(client, notification);
            break;

        case 'Reject':
            await handleReject(client, notification);
            break;

        case 'DeliveryDelay':
            await handleDeliveryDelay(client, notification);
            break;

        case 'Open':
            await handleOpen(client, notification);
            break;

        case 'Click':
            await handleClick(client, notification);
            break;

        case 'Subscription':
            await handleSubscription(client, notification);
            break;

        case 'Rendering Failure':
            await handleRenderingFailure(client, notification);
            break;

        default:
            log(`Unknown notification type: ${notificationType}`);
            await logWarn(client, EventType.SYSTEM_ERROR,
                `Unknown SQS notification type: ${notificationType}`, {
                sqsMessage: notification.rawMessage,
            });
    }

    // Delete message from SQS after processing
    await deleteMessage(notification.receiptHandle, sqsConfig);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle Send event - email accepted by SES for delivery.
 */
async function handleSend(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, leadId, campaignId, rawMessage } = notification;

    await logInfo(client, EventType.EMAIL_SENT,
        `Email accepted by SES: ${recipient}`, {
        leadId,
        campaignId,
        sesResponse: { messageId },
        sqsMessage: rawMessage,
    });
}

/**
 * Handle Delivery event - email successfully delivered to recipient's mail server.
 */
async function handleDelivery(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, leadId, campaignId, smtpResponse, processingTimeMs, rawMessage } = notification;

    // Find and update lead if we have a messageId
    const lead = await findLeadBySesMessageId(client, messageId);
    if (lead) {
        await updateLead(client, lead.$id, {
            status: LeadStatus.DELIVERED,
        });
    }

    await logInfo(client, EventType.EMAIL_DELIVERED,
        `Email delivered to ${recipient} (${processingTimeMs}ms)`, {
        leadId: lead?.$id || leadId,
        campaignId: lead?.campaignId || campaignId,
        sesResponse: { smtpResponse, processingTimeMs },
        sqsMessage: rawMessage,
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalDelivered: 1 });
    if (lead?.campaignId || campaignId) {
        await incrementCampaignMetrics(client, lead?.campaignId || campaignId!, { totalDelivered: 1 });
    }
}

/**
 * Handle Bounce event - email bounced (permanent or transient).
 */
async function handleBounce(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, bounceType, bounceSubType, leadId, campaignId, rawMessage } = notification;

    // Find lead by SES message ID
    const lead = await findLeadBySesMessageId(client, messageId);

    if (lead) {
        await updateLead(client, lead.$id, {
            status: LeadStatus.BOUNCED,
            bounceType: bounceType || null,
            bounceSubType: bounceSubType || null,
        });
    }

    await logWarn(client, EventType.BOUNCE_RECEIVED,
        `Bounce received for ${recipient}: ${bounceType}/${bounceSubType}`, {
        leadId: lead?.$id || leadId,
        campaignId: lead?.campaignId || campaignId,
        sqsMessage: rawMessage,
    });

    // Update metrics
    const isHardBounce = bounceType === 'Permanent';
    await incrementGlobalMetrics(client, {
        totalBounces: 1,
        totalHardBounces: isHardBounce ? 1 : 0,
        totalSoftBounces: isHardBounce ? 0 : 1,
    });

    if (lead?.campaignId || campaignId) {
        await incrementCampaignMetrics(client, lead?.campaignId || campaignId!, {
            totalBounces: 1,
            totalHardBounces: isHardBounce ? 1 : 0,
            totalSoftBounces: isHardBounce ? 0 : 1,
        });
    }
}

/**
 * Handle Complaint event - recipient marked email as spam.
 */
async function handleComplaint(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, complaintFeedbackType, leadId, campaignId, rawMessage } = notification;

    // Find lead by SES message ID
    const lead = await findLeadBySesMessageId(client, messageId);

    if (lead) {
        await updateLead(client, lead.$id, {
            status: LeadStatus.COMPLAINED,
            complaintFeedbackType: complaintFeedbackType || null,
        });
    }

    await logError(client, EventType.COMPLAINT_RECEIVED,
        `Complaint received for ${recipient}: ${complaintFeedbackType || 'unknown'}`, {
        leadId: lead?.$id || leadId,
        campaignId: lead?.campaignId || campaignId,
        sqsMessage: rawMessage,
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalComplaints: 1 });
    if (lead?.campaignId || campaignId) {
        await incrementCampaignMetrics(client, lead?.campaignId || campaignId!, { totalComplaints: 1 });
    }
}

/**
 * Handle Reject event - SES rejected the email (virus, spam, etc).
 */
async function handleReject(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, rejectReason, leadId, campaignId, rawMessage } = notification;

    // Find and update lead
    const lead = await findLeadBySesMessageId(client, messageId);
    if (lead) {
        await updateLead(client, lead.$id, {
            status: LeadStatus.FAILED,
        });
    }

    await logError(client, EventType.EMAIL_REJECTED,
        `Email rejected for ${recipient}: ${rejectReason}`, {
        leadId: lead?.$id || leadId,
        campaignId: lead?.campaignId || campaignId,
        sqsMessage: rawMessage,
        errorDetails: { reason: rejectReason },
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalRejected: 1, totalErrors: 1 });
    if (lead?.campaignId || campaignId) {
        await incrementCampaignMetrics(client, lead?.campaignId || campaignId!, { totalRejected: 1, totalErrors: 1 });
    }
}

/**
 * Handle DeliveryDelay event - temporary delivery issue, SES will retry.
 */
async function handleDeliveryDelay(client: Client, notification: SesNotification): Promise<void> {
    const { recipient, delayType, expirationTime, leadId, campaignId, rawMessage } = notification;

    await logWarn(client, EventType.EMAIL_DELAYED,
        `Delivery delayed for ${recipient}: ${delayType}`, {
        leadId,
        campaignId,
        sqsMessage: rawMessage,
        metadata: { delayType, expirationTime },
    });

    // Update metrics (just count, don't change lead status)
    await incrementGlobalMetrics(client, { totalDelayed: 1 });
    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, { totalDelayed: 1 });
    }
}

/**
 * Handle Open event - recipient opened the email (tracking pixel loaded).
 */
async function handleOpen(client: Client, notification: SesNotification): Promise<void> {
    const { recipient, ipAddress, userAgent, leadId, campaignId, rawMessage } = notification;

    await logInfo(client, EventType.EMAIL_OPENED,
        `Email opened by ${recipient}`, {
        leadId,
        campaignId,
        sqsMessage: rawMessage,
        metadata: { ipAddress, userAgent },
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalOpens: 1 });
    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, { totalOpens: 1 });
    }
}

/**
 * Handle Click event - recipient clicked a link in the email.
 */
async function handleClick(client: Client, notification: SesNotification): Promise<void> {
    const { recipient, ipAddress, userAgent, link, leadId, campaignId, rawMessage } = notification;

    await logInfo(client, EventType.EMAIL_CLICKED,
        `Link clicked by ${recipient}: ${link}`, {
        leadId,
        campaignId,
        sqsMessage: rawMessage,
        metadata: { ipAddress, userAgent, link },
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalClicks: 1 });
    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, { totalClicks: 1 });
    }
}

/**
 * Handle Subscription event - recipient used List-Unsubscribe.
 */
async function handleSubscription(client: Client, notification: SesNotification): Promise<void> {
    const { messageId, recipient, subscriptionSource, newTopicPreferences, leadId, campaignId, rawMessage } = notification;

    // Find and update lead to unsubscribed status
    const lead = await findLeadBySesMessageId(client, messageId);
    if (lead) {
        await updateLead(client, lead.$id, {
            status: LeadStatus.UNSUBSCRIBED,
        });
    }

    await logInfo(client, EventType.SUBSCRIPTION_CHANGED,
        `Subscription changed for ${recipient} via ${subscriptionSource}`, {
        leadId: lead?.$id || leadId,
        campaignId: lead?.campaignId || campaignId,
        sqsMessage: rawMessage,
        metadata: { subscriptionSource, newTopicPreferences },
    });
}

/**
 * Handle Rendering Failure event - email template failed to render.
 */
async function handleRenderingFailure(client: Client, notification: SesNotification): Promise<void> {
    const { templateName, errorMessage, leadId, campaignId, rawMessage } = notification;

    await logError(client, EventType.RENDERING_FAILURE,
        `Template rendering failed: ${templateName || 'unknown'}`, {
        leadId,
        campaignId,
        sqsMessage: rawMessage,
        errorDetails: { templateName, errorMessage },
    });

    // Update metrics
    await incrementGlobalMetrics(client, { totalErrors: 1 });
    if (campaignId) {
        await incrementCampaignMetrics(client, campaignId, { totalErrors: 1 });
    }
}
