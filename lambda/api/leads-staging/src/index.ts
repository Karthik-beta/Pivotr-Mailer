/**
 * Leads Staging Lambda
 *
 * Handles staging of leads before approval to main leads table.
 * All leads go through comprehensive validation before staging.
 *
 * SAFETY FEATURES:
 * - Indian name validation (sophisticated pattern matching)
 * - Email validation (format, disposable detection)
 * - Company name validation
 * - Phone number validation (Indian format)
 * - Batch validation with detailed error reporting
 *
 * Endpoints:
 * - GET /api/leads/staging - List staged leads
 * - GET /api/leads/staging/{id} - Get single staged lead
 * - POST /api/leads/staging - Stage leads (with validation)
 * - POST /api/leads/staging/validate - Validate leads without staging
 * - POST /api/leads/staging/{id}/approve - Approve staged lead to main table
 * - POST /api/leads/staging/approve-batch - Batch approve staged leads
 * - DELETE /api/leads/staging/{id} - Delete staged lead
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import type { LogLevel } from '@aws-lambda-powertools/logger/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand,
    BatchWriteCommand,
    TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    validateStagedLead,
    validateStagedLeads,
    type StagedLead,
    type LeadValidationResult,
    type BatchLeadValidationResult,
} from '/opt/nodejs/src/validation/staging-lead-validator.js';
import { parseIndianName } from '/opt/nodejs/src/utils/name-parser.js';

// =============================================================================
// Configuration
// =============================================================================

const logger = new Logger({
    serviceName: 'api-leads-staging',
    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
});

// Get endpoint configuration for LocalStack support
const awsEndpoint = process.env.AWS_ENDPOINT_URL;
const awsRegion = process.env.AWS_REGION ?? 'us-east-1';

const clientConfig = awsEndpoint
    ? { region: awsRegion, endpoint: awsEndpoint }
    : { region: awsRegion };

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: { removeUndefinedValues: true },
});

const STAGING_TABLE = process.env.DYNAMODB_TABLE_STAGING ?? '';
const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS ?? '';

// =============================================================================
// Types
// =============================================================================

type StagingStatus = 'PENDING_REVIEW' | 'VALIDATED' | 'REJECTED' | 'APPROVED';

interface StagedLeadRecord {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly companyName: string;
    readonly phoneNumber?: string;
    readonly leadType?: 'HARDWARE' | 'SOFTWARE' | 'BOTH';
    readonly status: StagingStatus;
    readonly validationResult: LeadValidationResult;
    readonly parsedFirstName: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly importBatchId?: string;
}

interface ApprovedLead {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly companyName: string;
    readonly phoneNumber?: string;
    readonly leadType?: 'HARDWARE' | 'SOFTWARE' | 'BOTH';
    readonly parsedFirstName: string;
    readonly status: 'PENDING_IMPORT';
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly approvedAt: string;
    readonly approvedFrom: string; // staging record ID
}

// =============================================================================
// API Response Helper
// =============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(body),
    };
}

// =============================================================================
// Main Handler
// =============================================================================

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    const { httpMethod, path, pathParameters, body } = event;

    logger.info('Handling staging request', { httpMethod, path });

    try {
        // Route based on method and path
        // GET /api/leads/staging - List staged leads
        if (httpMethod === 'GET' && !pathParameters?.id) {
            return await listStagedLeads(event);
        }

        // GET /api/leads/staging/{id} - Get single staged lead
        if (httpMethod === 'GET' && pathParameters?.id) {
            return await getStagedLead(pathParameters.id);
        }

        // POST /api/leads/staging/validate - Validate without staging
        if (httpMethod === 'POST' && path.endsWith('/validate')) {
            return await validateOnly(body);
        }

        // POST /api/leads/staging/{id}/approve - Approve single lead
        if (httpMethod === 'POST' && path.includes('/approve') && pathParameters?.id) {
            return await approveStagedLead(pathParameters.id);
        }

        // POST /api/leads/staging/approve-batch - Batch approve
        if (httpMethod === 'POST' && path.endsWith('/approve-batch')) {
            return await batchApproveStagedLeads(body);
        }

        // POST /api/leads/staging - Stage leads
        if (httpMethod === 'POST') {
            return await stageLeads(body);
        }

        // DELETE /api/leads/staging/{id} - Delete staged lead
        if (httpMethod === 'DELETE' && pathParameters?.id) {
            return await deleteStagedLead(pathParameters.id);
        }

        return response(404, { success: false, message: 'Not found' });
    } catch (error) {
        logger.error('Request failed', { error });
        return response(500, {
            success: false,
            message: error instanceof Error ? error.message : 'Internal server error',
        });
    }
};

// =============================================================================
// List Staged Leads
// =============================================================================

async function listStagedLeads(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const limit = parseInt(event.queryStringParameters?.limit ?? '50', 10);
    const statusFilter = event.queryStringParameters?.status;
    const lastKey = event.queryStringParameters?.lastKey;

    let command;

    if (statusFilter) {
        // Query by status using GSI
        command = new QueryCommand({
            TableName: STAGING_TABLE,
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': statusFilter },
            Limit: Math.min(limit, 100),
            ...(lastKey && { ExclusiveStartKey: JSON.parse(Buffer.from(lastKey, 'base64').toString()) }),
        });
    } else {
        // Scan all
        command = new ScanCommand({
            TableName: STAGING_TABLE,
            Limit: Math.min(limit, 100),
            ...(lastKey && { ExclusiveStartKey: JSON.parse(Buffer.from(lastKey, 'base64').toString()) }),
        });
    }

    const result = await docClient.send(command);

    return response(200, {
        success: true,
        data: result.Items,
        count: result.Items?.length ?? 0,
        lastKey: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : null,
    });
}

// =============================================================================
// Get Single Staged Lead
// =============================================================================

async function getStagedLead(id: string): Promise<APIGatewayProxyResult> {
    const result = await docClient.send(new GetCommand({
        TableName: STAGING_TABLE,
        Key: { id },
    }));

    if (!result.Item) {
        return response(404, { success: false, message: 'Staged lead not found' });
    }

    return response(200, { success: true, data: result.Item });
}

// =============================================================================
// Validate Only (without staging)
// =============================================================================

async function validateOnly(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const leads: StagedLead[] = Array.isArray(data.leads) ? data.leads : [data];

    const validationResult = validateStagedLeads(leads);

    return response(200, {
        success: true,
        validation: {
            totalCount: validationResult.totalCount,
            validCount: validationResult.validCount,
            invalidCount: validationResult.invalidCount,
            summary: validationResult.summary,
            results: validationResult.results.map((r: LeadValidationResult) => ({
                lead: r.lead,
                valid: r.valid,
                errors: r.errors,
                warnings: r.warnings,
                nameConfidence: r.nameValidation.confidence,
                namePattern: r.nameValidation.metadata.detectedPattern,
                isCorporateEmail: r.emailValidation.isCorporate,
            })),
        },
    });
}

// =============================================================================
// Stage Leads
// =============================================================================

async function stageLeads(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const leads: StagedLead[] = Array.isArray(data.leads) ? data.leads : [data];
    const importBatchId = data.batchId ?? crypto.randomUUID();

    if (leads.length === 0) {
        return response(400, { success: false, message: 'No leads provided' });
    }

    if (leads.length > 500) {
        return response(400, { success: false, message: 'Maximum 500 leads per batch' });
    }

    // Validate all leads
    const validationResult = validateStagedLeads(leads);
    const now = new Date().toISOString();

    // Create staging records
    const stagingRecords: StagedLeadRecord[] = validationResult.results.map((result: LeadValidationResult) => {
        const parsed = parseIndianName(result.lead.fullName);

        return {
            id: crypto.randomUUID(),
            fullName: result.nameValidation.normalizedName || result.lead.fullName,
            email: result.emailValidation.normalized || result.lead.email,
            companyName: result.companyValidation.normalized || result.lead.companyName,
            phoneNumber: result.phoneValidation?.normalized ?? result.lead.phoneNumber,
            leadType: result.lead.leadType,
            status: result.valid ? 'VALIDATED' : 'PENDING_REVIEW',
            validationResult: result,
            parsedFirstName: parsed.firstName,
            createdAt: now,
            updatedAt: now,
            importBatchId,
        };
    });

    // Batch write to staging table (max 25 per batch)
    const chunks = chunkArray(stagingRecords, 25);
    let stagedCount = 0;

    for (const chunk of chunks) {
        const putRequests = chunk.map(record => ({
            PutRequest: { Item: record },
        }));

        try {
            await docClient.send(new BatchWriteCommand({
                RequestItems: {
                    [STAGING_TABLE]: putRequests,
                },
            }));
            stagedCount += chunk.length;
        } catch (err) {
            logger.error('Batch write failed', { error: err });
        }
    }

    logger.info('Leads staged', {
        total: leads.length,
        staged: stagedCount,
        valid: validationResult.validCount,
        invalid: validationResult.invalidCount,
        batchId: importBatchId,
    });

    return response(201, {
        success: true,
        data: {
            batchId: importBatchId,
            totalCount: leads.length,
            stagedCount,
            validCount: validationResult.validCount,
            invalidCount: validationResult.invalidCount,
            summary: validationResult.summary,
        },
    });
}

// =============================================================================
// Approve Single Staged Lead
// =============================================================================

async function approveStagedLead(id: string): Promise<APIGatewayProxyResult> {
    // Get the staged record
    const getResult = await docClient.send(new GetCommand({
        TableName: STAGING_TABLE,
        Key: { id },
    }));

    if (!getResult.Item) {
        return response(404, { success: false, message: 'Staged lead not found' });
    }

    const staged = getResult.Item as StagedLeadRecord;

    if (staged.status === 'APPROVED') {
        return response(400, { success: false, message: 'Lead already approved' });
    }

    if (staged.status === 'REJECTED') {
        return response(400, { success: false, message: 'Cannot approve rejected lead' });
    }

    const now = new Date().toISOString();

    // Create the approved lead record
    const approvedLead: ApprovedLead = {
        id: crypto.randomUUID(),
        fullName: staged.fullName,
        email: staged.email,
        companyName: staged.companyName,
        phoneNumber: staged.phoneNumber,
        leadType: staged.leadType,
        parsedFirstName: staged.parsedFirstName,
        status: 'PENDING_IMPORT',
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
        approvedFrom: staged.id,
    };

    // Use transaction to ensure atomicity
    await docClient.send(new TransactWriteCommand({
        TransactItems: [
            {
                Put: {
                    TableName: LEADS_TABLE,
                    Item: approvedLead,
                    ConditionExpression: 'attribute_not_exists(id)',
                },
            },
            {
                Update: {
                    TableName: STAGING_TABLE,
                    Key: { id: staged.id },
                    UpdateExpression: 'SET #status = :status, updatedAt = :now',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'APPROVED', ':now': now },
                },
            },
        ],
    }));

    logger.info('Lead approved', { stagingId: staged.id, leadId: approvedLead.id });

    return response(200, {
        success: true,
        data: {
            stagingId: staged.id,
            leadId: approvedLead.id,
            lead: approvedLead,
        },
    });
}

// =============================================================================
// Batch Approve Staged Leads
// =============================================================================

async function batchApproveStagedLeads(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const ids: string[] = data.ids;
    const approveValidatedOnly = data.approveValidatedOnly ?? true;

    if (!Array.isArray(ids) || ids.length === 0) {
        return response(400, { success: false, message: 'ids array required' });
    }

    if (ids.length > 100) {
        return response(400, { success: false, message: 'Maximum 100 leads per batch approval' });
    }

    const now = new Date().toISOString();
    const results = {
        approved: 0,
        skipped: 0,
        failed: 0,
        details: [] as Array<{ id: string; status: string; message: string }>,
    };

    for (const id of ids) {
        try {
            // Get the staged record
            const getResult = await docClient.send(new GetCommand({
                TableName: STAGING_TABLE,
                Key: { id },
            }));

            if (!getResult.Item) {
                results.skipped++;
                results.details.push({ id, status: 'skipped', message: 'Not found' });
                continue;
            }

            const staged = getResult.Item as StagedLeadRecord;

            if (staged.status === 'APPROVED') {
                results.skipped++;
                results.details.push({ id, status: 'skipped', message: 'Already approved' });
                continue;
            }

            if (approveValidatedOnly && staged.status !== 'VALIDATED') {
                results.skipped++;
                results.details.push({ id, status: 'skipped', message: 'Not validated' });
                continue;
            }

            // Create and approve
            const approvedLead: ApprovedLead = {
                id: crypto.randomUUID(),
                fullName: staged.fullName,
                email: staged.email,
                companyName: staged.companyName,
                phoneNumber: staged.phoneNumber,
                leadType: staged.leadType,
                parsedFirstName: staged.parsedFirstName,
                status: 'PENDING_IMPORT',
                createdAt: now,
                updatedAt: now,
                approvedAt: now,
                approvedFrom: staged.id,
            };

            await docClient.send(new TransactWriteCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: LEADS_TABLE,
                            Item: approvedLead,
                        },
                    },
                    {
                        Update: {
                            TableName: STAGING_TABLE,
                            Key: { id: staged.id },
                            UpdateExpression: 'SET #status = :status, updatedAt = :now',
                            ExpressionAttributeNames: { '#status': 'status' },
                            ExpressionAttributeValues: { ':status': 'APPROVED', ':now': now },
                        },
                    },
                ],
            }));

            results.approved++;
            results.details.push({ id, status: 'approved', message: `Lead ID: ${approvedLead.id}` });
        } catch (error) {
            results.failed++;
            results.details.push({
                id,
                status: 'failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    logger.info('Batch approval complete', results);

    return response(200, {
        success: true,
        data: results,
    });
}

// =============================================================================
// Delete Staged Lead
// =============================================================================

async function deleteStagedLead(id: string): Promise<APIGatewayProxyResult> {
    await docClient.send(new DeleteCommand({
        TableName: STAGING_TABLE,
        Key: { id },
        ConditionExpression: 'attribute_exists(id)',
    }));

    logger.info('Staged lead deleted', { id });

    return response(200, { success: true, message: 'Staged lead deleted' });
}

// =============================================================================
// Utility Functions
// =============================================================================

function chunkArray<T>(array: readonly T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size) as T[]);
    }
    return result;
}
