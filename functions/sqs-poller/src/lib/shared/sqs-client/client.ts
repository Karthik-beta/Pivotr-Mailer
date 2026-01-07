/**
 * AWS SQS Client
 *
 * Polls AWS SQS for bounce and complaint notifications from SES via SNS.
 * Long polling is used to reduce API calls while maintaining responsiveness.
 */

import type { Message } from '@aws-sdk/client-sqs';
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

/**
 * SQS client configuration
 */
export interface SqsConfig {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    queueUrl: string;
    waitTimeSeconds: number; // Long polling wait time (max 20)
    maxMessages: number; // Max messages per poll (max 10)
}

/**
 * SNS notification types from SES
 */
export type NotificationType = 'Bounce' | 'Complaint' | 'Delivery';

/**
 * Parsed SNS notification from SES
 */
export interface SesNotification {
    notificationType: NotificationType;
    messageId: string;
    timestamp: string;
    leadId?: string;
    campaignId?: string;
    recipient: string;
    // Bounce-specific fields
    bounceType?: 'Permanent' | 'Transient' | 'Undetermined';
    bounceSubType?: string;
    // Complaint-specific fields
    complaintFeedbackType?: string;
    // Raw message
    rawMessage: Record<string, unknown>;
    // SQS receipt handle for deletion
    receiptHandle: string;
}

/**
 * SQS client instance cache
 */
let sqsClient: SQSClient | null = null;

/**
 * Initialize or get the SQS client.
 */
function getClient(config: SqsConfig): SQSClient {
    if (!sqsClient) {
        sqsClient = new SQSClient({
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }
    return sqsClient;
}

/**
 * Poll SQS queue for messages.
 * Uses long polling for efficiency.
 */
export async function pollMessages(config: SqsConfig): Promise<SesNotification[]> {
    const client = getClient(config);

    const command = new ReceiveMessageCommand({
        QueueUrl: config.queueUrl,
        MaxNumberOfMessages: Math.min(config.maxMessages, 10),
        WaitTimeSeconds: Math.min(config.waitTimeSeconds, 20),
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
    });

    const response = await client.send(command);

    if (!response.Messages || response.Messages.length === 0) {
        return [];
    }

    const notifications: SesNotification[] = [];

    for (const message of response.Messages) {
        try {
            const parsed = parseMessage(message);
            if (parsed) {
                notifications.push(parsed);
            }
        } catch (error) {
            console.error('Failed to parse SQS message:', error);
            // Still include receipt handle for cleanup
            notifications.push({
                notificationType: 'Delivery', // Placeholder
                messageId: '',
                timestamp: new Date().toISOString(),
                recipient: '',
                rawMessage: { error: 'Parse failed', body: message.Body },
                receiptHandle: message.ReceiptHandle || '',
            });
        }
    }

    return notifications;
}

/**
 * Parse an SQS message containing an SNS notification from SES.
 */
function parseMessage(message: Message): SesNotification | null {
    if (!message.Body || !message.ReceiptHandle) {
        return null;
    }

    // SQS message body contains SNS notification
    const snsWrapper = JSON.parse(message.Body);

    // SNS Message field contains the actual SES notification
    const sesNotification =
        typeof snsWrapper.Message === 'string'
            ? JSON.parse(snsWrapper.Message)
            : snsWrapper.Message || snsWrapper;

    const notificationType = sesNotification.notificationType as NotificationType;

    // Extract common fields
    const mail = sesNotification.mail || {};
    const messageId = mail.messageId || '';
    const timestamp = sesNotification.timestamp || mail.timestamp || new Date().toISOString();

    // Extract lead/campaign IDs from tags
    const tags = mail.tags || {};
    const leadId = tags.lead_id?.[0] || undefined;
    const campaignId = tags.campaign_id?.[0] || undefined;

    // Extract recipient
    let recipient = '';
    if (notificationType === 'Bounce' && sesNotification.bounce?.bouncedRecipients?.[0]) {
        recipient = sesNotification.bounce.bouncedRecipients[0].emailAddress;
    } else if (
        notificationType === 'Complaint' &&
        sesNotification.complaint?.complainedRecipients?.[0]
    ) {
        recipient = sesNotification.complaint.complainedRecipients[0].emailAddress;
    } else if (mail.destination?.[0]) {
        recipient = mail.destination[0];
    }

    const notification: SesNotification = {
        notificationType,
        messageId,
        timestamp,
        leadId,
        campaignId,
        recipient,
        rawMessage: sesNotification,
        receiptHandle: message.ReceiptHandle,
    };

    // Add bounce-specific fields
    if (notificationType === 'Bounce' && sesNotification.bounce) {
        notification.bounceType = sesNotification.bounce.bounceType;
        notification.bounceSubType = sesNotification.bounce.bounceSubType;
    }

    // Add complaint-specific fields
    if (notificationType === 'Complaint' && sesNotification.complaint) {
        notification.complaintFeedbackType = sesNotification.complaint.complaintFeedbackType;
    }

    return notification;
}

/**
 * Delete a message from the queue after processing.
 */
export async function deleteMessage(receiptHandle: string, config: SqsConfig): Promise<void> {
    const client = getClient(config);

    const command = new DeleteMessageCommand({
        QueueUrl: config.queueUrl,
        ReceiptHandle: receiptHandle,
    });

    await client.send(command);
}

/**
 * Delete multiple messages from the queue.
 */
export async function deleteMessages(
    notifications: SesNotification[],
    config: SqsConfig
): Promise<void> {
    for (const notification of notifications) {
        if (notification.receiptHandle) {
            await deleteMessage(notification.receiptHandle, config);
        }
    }
}

/**
 * Reset the SQS client (for testing or config changes)
 */
export function resetSqsClient(): void {
    if (sqsClient) {
        sqsClient.destroy();
        sqsClient = null;
    }
}
