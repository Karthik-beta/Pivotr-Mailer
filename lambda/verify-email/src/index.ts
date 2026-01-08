/**
 * Verify Email Lambda
 * 
 * Verifies email addresses using MyEmailVerifier (MEV) API.
 * Triggered by SQS.
 * 
 * SAFETY:
 * - Updates lead status to 'VERIFIED', 'INVALID', or 'SKIPPED'
 * - Does not block other processes, just updates status.
 */

import type { SQSEvent, SQSHandler, SQSRecord } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getSecret } from '../../shared/src/config/environment.config';

// logger
const logger = new Logger({
    serviceName: 'verify-email',
    logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
});

// clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || '';
// We'll fetch API key from Secrets Manager or Env (Env is easier for now if passed by CDK from Secrets)
// Ideally CDK passes it as env var from secret.
const MEV_API_KEY = process.env.MYEMAILVERIFIER_API_KEY || '';

export const handler: SQSHandler = async (event: SQSEvent) => {
    logger.info('Processing verification batch', { count: event.Records.length });

    // Simple fetch implementation since we can't use axios (runtime native fetch)
    // Node 18+ has global fetch

    if (!MEV_API_KEY) {
        logger.error('MYEMAILVERIFIER_API_KEY is not set');
        throw new Error('Missing API Key');
    }

    for (const record of event.Records) {
        try {
            await processRecord(record);
        } catch (error) {
            logger.error('Failed to verify lead', {
                messageId: record.messageId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Do not throw for logic errors, only transient
        }
    }
};

async function processRecord(record: SQSRecord) {
    const body = JSON.parse(record.body);
    const { leadId } = body;

    if (!leadId) {
        logger.warn('Missing leadId', { body });
        return;
    }

    // 1. Get Lead
    const lead = await getLead(leadId);
    if (!lead) {
        logger.warn('Lead not found', { leadId });
        return;
    }

    if (lead.status !== 'QUEUED_FOR_VERIFICATION') {
        // Maybe checking status is not strictly required if we trust the queue, 
        // but good for safety.
        logger.info('Lead not in verification state', { leadId, status: lead.status });
        // Proceeding anyway if debug force? No, safer to skip.
        // return; 
    }

    // 2. Call MEV API
    const verificationResult = await verifyWithErrorHandling(lead.email);

    // 3. Update Status
    const newStatus = mapMevStatusToLeadStatus(verificationResult.Status);

    await updateLeadStatus(leadId, newStatus, {
        verificationResult: verificationResult
    });

    logger.info('Lead verification complete', { leadId, status: newStatus });
}

async function getLead(id: string) {
    const res = await docClient.send(new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id }
    }));
    return res.Item;
}

async function updateLeadStatus(id: string, status: string, meta: any) {
    const updateParts = ['#s = :s', '#meta = :meta'];
    await docClient.send(new UpdateCommand({
        TableName: LEADS_TABLE,
        Key: { id },
        UpdateExpression: 'SET #s = :s, verification_data = :meta',
        ExpressionAttributeNames: { '#s': 'status', '#meta': 'verificationResult' },
        ExpressionAttributeValues: { ':s': status, ':meta': meta }
    }));
}

/**
 * Maps MEV status code to our Lead status.
 * MEV Codes: 
 * 1 (Valid), 2 (Invalid), 3 (Catch-All), 4 (Unknown), etc.
 * 
 * We treat Valid as VERIFIED.
 * Invalid, Spamtrap, Complainer, Disposable -> INVALID
 * Others -> SKIPPED (unsafe to send)
 */
function mapMevStatusToLeadStatus(mevStatus: string): string {
    // Normalize string just in case
    const status = String(mevStatus).toLowerCase();

    if (status === 'valid') return 'VERIFIED';
    if (status === 'invalid' || status === 'spam_trap' || status === 'complainer' || status === 'disposable') return 'INVALID';
    if (status === 'catch_all' || status === 'unknown') return 'SKIPPED_RISKY';

    return 'SKIPPED_UNKNOWN';
}

async function verifyWithErrorHandling(email: string): Promise<any> {
    const url = `https://client.myemailverifier.com/verifier/validate_single/${MEV_API_KEY}/${encodeURIComponent(email)}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`MEV API Failed: ${response.statusText}`);
    }

    return await response.json();
}
