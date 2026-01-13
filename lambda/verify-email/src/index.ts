/**
 * Verify Email Lambda
 *
 * Verifies email addresses using MyEmailVerifier (MEV) API.
 * Triggered by SQS.
 *
 * STATE MACHINE:
 * - Lead arrives with status = 'VERIFYING' (set by campaign-processor)
 * - After verification, lead returns to status = 'QUEUED' with verificationStatus populated
 * - This allows campaign-processor to pick up the lead again and route it correctly
 *
 * IMPORTANT: Verification is a TEMPORARY DETOUR, not a terminal state.
 * The verificationStatus field stores the verification result (ok, invalid, catch_all, unknown).
 * The status field represents workflow position only.
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

    if (lead.status !== 'VERIFYING') {
        // Lead might have been processed already or rolled back
        // Log for observability but proceed anyway - the verification result is still valuable
        logger.info('Lead not in expected VERIFYING state', { leadId, status: lead.status });
        // Proceeding anyway if debug force? No, safer to skip.
        // return; 
    }

    // 2. Call MEV API
    const verificationResult = await verifyWithErrorHandling(lead.email);

    // 3. Update verification result and return lead to QUEUED
    const verificationStatus = mapMevStatusToVerificationStatus(verificationResult.Status);

    await updateLeadWithVerificationResult(leadId, verificationStatus, verificationResult);

    logger.info('Lead verification complete', { leadId, verificationStatus });
}

async function getLead(id: string) {
    const res = await docClient.send(new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id }
    }));
    return res.Item;
}

/**
 * Updates lead with verification result and returns it to QUEUED status.
 *
 * KEY DESIGN DECISION: We set status back to 'QUEUED' so the campaign-processor
 * can pick up the lead again. The verificationStatus field stores the actual
 * verification result, which categorizeLeads() uses to route the lead appropriately.
 */
async function updateLeadWithVerificationResult(id: string, verificationStatus: string, verificationData: any) {
    await docClient.send(new UpdateCommand({
        TableName: LEADS_TABLE,
        Key: { id },
        UpdateExpression: 'SET #status = :queued, #verificationStatus = :verificationStatus, #verificationResult = :verificationData, #updatedAt = :now',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#verificationStatus': 'verificationStatus',
            '#verificationResult': 'verificationResult'
        },
        ExpressionAttributeValues: {
            ':queued': 'QUEUED',  // Return to workflow queue for campaign-processor pickup
            ':verificationStatus': verificationStatus,
            ':verificationData': verificationData,
            ':now': new Date().toISOString()
        }
    }));
}

/**
 * Maps MEV status code to verificationStatus field value.
 *
 * NOTE: These values are stored in the verificationStatus field, NOT the status field.
 * The status field is reserved for workflow position (QUEUED, VERIFYING, SENDING, etc.)
 *
 * MEV Codes:
 * 1 (Valid), 2 (Invalid), 3 (Catch-All), 4 (Unknown), etc.
 *
 * Return values match what campaign-processor's categorizeLeads() expects:
 * - 'ok' or 'VERIFIED' → ready to send
 * - 'catch_all' or 'RISKY' → depends on campaign.sendCriteria.allowCatchAll
 * - 'unknown' → depends on campaign.sendCriteria.allowUnknown
 * - 'invalid' → skip (don't send)
 */
function mapMevStatusToVerificationStatus(mevStatus: string): string {
    const status = String(mevStatus).toLowerCase();

    if (status === 'valid') return 'ok';
    if (status === 'invalid' || status === 'spam_trap' || status === 'complainer' || status === 'disposable') return 'invalid';
    if (status === 'catch_all') return 'catch_all';
    if (status === 'unknown') return 'unknown';

    // Fallback for any unrecognized status
    return 'unknown';
}

async function verifyWithErrorHandling(email: string): Promise<any> {
    const url = `https://client.myemailverifier.com/verifier/validate_single/${MEV_API_KEY}/${encodeURIComponent(email)}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`MEV API Failed: ${response.statusText}`);
    }

    return await response.json();
}
