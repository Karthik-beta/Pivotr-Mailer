/**
 * Send Email Lambda
 * 
 * Handles sending emails via SES.
 * Features:
 * - Spintax resolution
 * - Variable injection
 * - Daily sending cap enforcement (Application Level)
 * - Updates lead status
 */

import type { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { resolveSpintax, injectVariables } from '../../shared/src/utils/spintax';
import { DAILY_SENDING_CAP } from '../../shared/src/config/safety.config';

// Initialize Logging
const logger = new Logger({
    serviceName: 'send-email',
    logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
});

// Initialize Clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'ap-south-1' });

// Configuration
const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || '';
const METRICS_TABLE = process.env.DYNAMODB_TABLE_METRICS || '';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || '';
const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || '';

/**
 * Lead Interface
 */
interface Lead {
    id: string;
    email: string;
    fullName: string;
    companyName: string;
    status: string;
    campaignId?: string;
    // ... other fields
}

export const handler: SQSHandler = async (event: SQSEvent) => {
    logger.info('Processing send-email batch', { count: event.Records.length });

    for (const record of event.Records) {
        try {
            await processRecord(record);
        } catch (error) {
            logger.error('Failed to process message', {
                messageId: record.messageId,
                error: error instanceof Error ? error.message : String(error)
            });
            // We do NOT throw here to avoid infinite loops specifically for logic errors.
            // Transient errors (network) should ideally be thrown to trigger SQS retry,
            // but implementing granular error handling is next step.
            if (error instanceof Error && error.name === 'TransientError') {
                throw error; // Trigger retry
            }
        }
    }
};

async function processRecord(record: SQSRecord): Promise<void> {
    const body = JSON.parse(record.body);
    const { leadId, campaignId, subjectTemplate, bodyTemplate } = body;

    if (!leadId || !campaignId) {
        logger.warn('Missing leadId or campaignId in message', { body });
        return;
    }

    // 1. Check Daily Cap
    const allowed = await checkAndIncrementDailyCap();
    if (!allowed) {
        logger.warn('Daily sending cap reached. Re-queueing or skipping.', { leadId });
        // TODO: Throwing here would cause retry, which might be okay if we want to try later.
        // For now, we prefer to update status to SKIPPED to be safe and visible.
        await updateLeadStatus(leadId, 'SKIPPED_DAILY_CAP');
        return;
    }

    // 2. Fetch Lead
    const lead = await getLead(leadId);
    if (!lead) {
        logger.warn('Lead not found', { leadId });
        return;
    }

    if (lead.status !== 'QUEUED' && lead.status !== 'PENDING_IMPORT') {
        logger.info('Lead status is not QUEUED, skipping', { leadId, status: lead.status });
        return;
    }

    // 3. Prepare Content
    // Resolve Spintax first
    const resolvedSubjectFn = resolveSpintax(subjectTemplate);
    const resolvedBodyFn = resolveSpintax(bodyTemplate);

    // Inject Variables
    const variables = {
        firstName: lead.fullName.split(' ')[0], // Simple split
        fullName: lead.fullName,
        company: lead.companyName,
        email: lead.email,
    };

    const finalSubject = injectVariables(resolvedSubjectFn, variables);
    const finalBody = injectVariables(resolvedBodyFn, variables);

    // 4. Send Email
    try {
        const response = await sesClient.send(new SendEmailCommand({
            Source: SES_FROM_EMAIL,
            Destination: { ToAddresses: [lead.email] },
            Message: {
                Subject: { Data: finalSubject, Charset: 'UTF-8' },
                Body: { Html: { Data: finalBody, Charset: 'UTF-8' } },
            },
            ConfigurationSetName: SES_CONFIGURATION_SET || undefined,
        }));

        logger.info('Email sent successfully', {
            leadId,
            messageId: response.MessageId
        });

        // 5. Update Lead Status
        await updateLeadStatus(leadId, 'SENT', {
            lastMessageId: response.MessageId,
            sentAt: new Date().toISOString(),
            subjectSent: finalSubject, // Useful for debugging
        });

    } catch (error) {
        logger.error('SES Send Failed', { leadId, error });
        await updateLeadStatus(leadId, 'FAILED', {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error; // Allow SQS retry for SES failures
    }
}

/**
 * Atomically check and increment the daily global counter.
 * Returns true if allowed, false if cap exceeded.
 */
async function checkAndIncrementDailyCap(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    try {
        const result = await docClient.send(new UpdateCommand({
            TableName: METRICS_TABLE,
            Key: { pk: 'GLOBAL', sk: today },
            UpdateExpression: 'ADD sentCount :inc',
            ExpressionAttributeValues: { ':inc': 1 },
            ReturnValues: 'UPDATED_NEW',
        }));

        const currentCount = result.Attributes?.sentCount || 0;

        // Check if we exceeded cap
        if (currentCount > DAILY_SENDING_CAP) {
            // Revert the increment (optional, but good for accuracy)
            // Actually, since it's atomic, we just decide not to send. 
            // The count will be slightly higher than cap, which implies attempted sends.
            return false;
        }

        return true;
    } catch (error) {
        logger.error('Failed to check daily cap', { error });
        // Fail safe: If we can't check cap, we stop sending.
        return false;
    }
}

async function getLead(leadId: string): Promise<Lead | null> {
    const result = await docClient.send(new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id: leadId },
    }));
    return result.Item as Lead;
}

async function updateLeadStatus(leadId: string, status: string, additionalAttributes: Record<string, any> = {}) {
    const updateParts = ['#s = :s'];
    const names: Record<string, string> = { '#s': 'status' };
    const values: Record<string, any> = { ':s': status };

    Object.entries(additionalAttributes).forEach(([key, val], idx) => {
        const attrKey = `#attr${idx}`;
        const valKey = `:val${idx}`;
        updateParts.push(`${attrKey} = ${valKey}`);
        names[attrKey] = key;
        values[valKey] = val;
    });

    await docClient.send(new UpdateCommand({
        TableName: LEADS_TABLE,
        Key: { id: leadId },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    }));
}
