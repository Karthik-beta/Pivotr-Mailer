/**
 * Process Feedback Lambda
 * 
 * Handles SES feedback events (bounces, complaints, deliveries) from SQS.
 * Updates lead status and metrics in DynamoDB.
 * 
 * SAFETY FEATURES:
 * - Concurrency limit: 10 (set in CDK, not here)
 * - Timeout: 10s (set in CDK, not here)
 * - Memory: 128 MB (set in CDK, not here)
 * - Non-retryable errors are not thrown (prevents DLQ overflow)
 * 
 * Reference: PRD Section 5.3, AWS_IMPLEMENTATION_GUIDE.md Phase 3
 */

import type { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import type { LogLevel } from '@aws-lambda-powertools/logger/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize logger
const logger = new Logger({
    serviceName: 'process-feedback',
    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
});

// Initialize DynamoDB client (reused across warm invocations)
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Table names from environment
const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || '';
const METRICS_TABLE = process.env.DYNAMODB_TABLE_METRICS || '';
const CAMPAIGNS_TABLE = process.env.DYNAMODB_TABLE_CAMPAIGNS || '';

// Reputation thresholds (from PRD Section 5.3.7)
const MAX_BOUNCE_RATE = 0.05; // 5%
const MAX_COMPLAINT_RATE = 0.001; // 0.1%

/**
 * SES notification structure from SNS via SQS.
 */
interface SesNotification {
    notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Send' | 'Open' | 'Click';
    mail: {
        messageId: string;
        destination: string[];
        timestamp: string;
    };
    bounce?: {
        bounceType: string;
        bounceSubType: string;
        bouncedRecipients: Array<{ emailAddress: string }>;
    };
    complaint?: {
        complainedRecipients: Array<{ emailAddress: string }>;
        complaintFeedbackType?: string;
    };
    delivery?: {
        recipients: string[];
        timestamp: string;
    };
}

/**
 * Lambda handler for SQS events.
 */
export const handler: SQSHandler = async (event: SQSEvent) => {
    logger.info('Processing feedback batch', { recordCount: event.Records.length });

    const results = {
        processed: 0,
        bounces: 0,
        complaints: 0,
        deliveries: 0,
        errors: 0,
    };

    const batchItemFailures: { itemIdentifier: string }[] = [];

    for (const record of event.Records) {
        try {
            await processRecord(record, results);
            results.processed++;
        } catch (error) {
            // Log but return to SQS for retry
            logger.error('Error processing record', {
                messageId: record.messageId,
                error: error instanceof Error ? error.message : String(error),
            });
            results.errors++;
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    logger.info('Batch processing complete', results);

    // Check reputation once per batch if needed
    if (results.bounces > 0) {
        await checkReputationAndPause('bounce');
    }
    if (results.complaints > 0) {
        await checkReputationAndPause('complaint');
    }

    return { batchItemFailures };
};

/**
 * Process a single SQS record.
 */
async function processRecord(
    record: SQSRecord,
    results: { bounces: number; complaints: number; deliveries: number }
): Promise<void> {
    // Parse SNS wrapper
    const snsMessage = JSON.parse(record.body);
    const notification: SesNotification = JSON.parse(snsMessage.Message);

    const { notificationType, mail } = notification;
    const messageId = mail.messageId;

    logger.info('Processing notification', { notificationType, messageId });

    switch (notificationType) {
        case 'Bounce':
            await handleBounce(notification);
            results.bounces++;
            break;

        case 'Complaint':
            await handleComplaint(notification);
            results.complaints++;
            break;

        case 'Delivery':
            await handleDelivery(notification);
            results.deliveries++;
            break;

        case 'Send':
        case 'Open':
        case 'Click':
            // These are informational, just log
            logger.info('Informational event', { notificationType, messageId });
            break;

        default:
            logger.warn('Unknown notification type', { notificationType });
    }
}

/**
 * Handle bounce notification.
 */
async function handleBounce(notification: SesNotification): Promise<void> {
    const { bounce, mail } = notification;
    if (!bounce) return;

    for (const recipient of bounce.bouncedRecipients) {
        const email = recipient.emailAddress.toLowerCase();

        // Update lead status
        await updateLeadByMessageId(mail.messageId, {
            status: 'BOUNCED',
            bounceType: bounce.bounceType,
            bounceSubType: bounce.bounceSubType,
        });

        logger.info('Lead marked as bounced', {
            email,
            bounceType: bounce.bounceType,
            bounceSubType: bounce.bounceSubType,
        });
    }

    // Increment bounce counter in metrics
    await incrementMetric('bounces');
}

/**
 * Handle complaint notification.
 */
async function handleComplaint(notification: SesNotification): Promise<void> {
    const { complaint, mail } = notification;
    if (!complaint) return;

    for (const recipient of complaint.complainedRecipients) {
        const email = recipient.emailAddress.toLowerCase();

        // Update lead status
        await updateLeadByMessageId(mail.messageId, {
            status: 'COMPLAINED',
            complaintFeedbackType: complaint.complaintFeedbackType || 'unknown',
            isUnsubscribed: true,
            unsubscribedAt: new Date().toISOString(),
        });

        logger.warn('Lead complained (marked as spam)', {
            email,
            feedbackType: complaint.complaintFeedbackType,
        });
    }

    // Increment complaint counter in metrics
    await incrementMetric('complaints');
}

/**
 * Handle delivery notification.
 */
async function handleDelivery(notification: SesNotification): Promise<void> {
    const { delivery, mail } = notification;
    if (!delivery) return;

    // Update lead status
    await updateLeadByMessageId(mail.messageId, {
        status: 'DELIVERED',
        deliveredAt: delivery.timestamp,
    });

    // Increment delivery counter
    await incrementMetric('deliveries');

    logger.info('Email delivered', { messageId: mail.messageId });
}

/**
 * Update lead document by SES message ID.
 */
async function updateLeadByMessageId(
    messageId: string,
    updates: Record<string, unknown>
): Promise<void> {
    // Build update expression dynamically
    const updateExpressionParts: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value], index) => {
        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        updateExpressionParts.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
    });

    // 1. Find the Lead ID using the MessageIdIndex
    try {
        const queryResult = await docClient.send(new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: 'MessageIdIndex',
            KeyConditionExpression: 'lastMessageId = :mid',
            ExpressionAttributeValues: {
                ':mid': messageId,
            },
            Limit: 1,
        }));

        if (!queryResult.Items || queryResult.Items.length === 0) {
            logger.warn('No lead found for messageId', { messageId });
            return;
        }

        const leadId = queryResult.Items[0].id;

        logger.info('Found lead for feedback', { leadId, messageId });

        // 2. Update the Lead using the found ID
        await docClient.send(new UpdateCommand({
            TableName: LEADS_TABLE,
            Key: { id: leadId },
            UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));

        logger.info('Successfully updated lead status', { leadId, status: updates.status });

    } catch (error) {
        logger.error('Failed to update lead by messageId', { messageId, error });
        throw error;
    }
}

/**
 * Increment a metric counter in DynamoDB.
 */
async function incrementMetric(metricName: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        await docClient.send(new UpdateCommand({
            TableName: METRICS_TABLE,
            Key: {
                pk: 'GLOBAL',
                sk: today,
            },
            UpdateExpression: `ADD #metric :inc`,
            ExpressionAttributeNames: {
                '#metric': metricName,
            },
            ExpressionAttributeValues: {
                ':inc': 1,
            },
        }));
    } catch (error) {
        logger.error('Failed to increment metric', { metricName, error });
    }
}

/**
 * Check reputation metrics and auto-pause campaigns if thresholds exceeded.
 */
async function checkReputationAndPause(eventType: 'bounce' | 'complaint'): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    try {
        // Get today's metrics
        const response = await docClient.send(new GetCommand({
            TableName: METRICS_TABLE,
            Key: {
                pk: 'GLOBAL',
                sk: today,
            },
        }));

        const metrics = response.Item || {};
        const sent = (metrics.sent as number) || 0;
        const bounces = (metrics.bounces as number) || 0;
        const complaints = (metrics.complaints as number) || 0;

        if (sent === 0) return;

        const bounceRate = bounces / sent;
        const complaintRate = complaints / sent;

        // Check thresholds
        if (eventType === 'bounce' && bounceRate > MAX_BOUNCE_RATE) {
            logger.error('REPUTATION RISK: Bounce rate exceeded threshold', {
                bounceRate,
                threshold: MAX_BOUNCE_RATE,
                action: 'AUTO_PAUSE_CAMPAIGNS',
            });
            await pauseAllActiveCampaigns('Bounce rate exceeded 5%');
        }

        if (eventType === 'complaint' && complaintRate > MAX_COMPLAINT_RATE) {
            logger.error('REPUTATION RISK: Complaint rate exceeded threshold', {
                complaintRate,
                threshold: MAX_COMPLAINT_RATE,
                action: 'AUTO_PAUSE_CAMPAIGNS',
            });
            await pauseAllActiveCampaigns('Complaint rate exceeded 0.1%');
        }
    } catch (error) {
        logger.error('Failed to check reputation', { error });
    }
}

/**
 * Pause all active campaigns due to reputation risk.
 */
async function pauseAllActiveCampaigns(reason: string): Promise<void> {
    // This would query for active campaigns and update their status
    // Simplified for now - would need DynamoDB Query in real implementation
    logger.warn('AUTO-PAUSING all campaigns', { reason });

    // TODO: Implement campaign pause logic
    // 1. Query campaigns with status = 'RUNNING'
    // 2. Update each to status = 'PAUSED_REPUTATION_RISK'
    // 3. Log the action
}
