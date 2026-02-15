/**
 * API Leads Lambda
 * 
 * Handles Lead CRUD operations via API Gateway.
 * 
 * SAFETY FEATURES:
 * - Concurrency limit: 10 (shared with other API handlers, set in CDK)
 * - Timeout: 10s (set in CDK)
 * - Memory: 256 MB (set in CDK)
 * - Input validation before any database operations
 * 
 * Endpoints:
 * - GET /api/leads - List leads with pagination
 * - GET /api/leads/{id} - Get single lead
 * - POST /api/leads - Create lead
 * - PUT /api/leads/{id} - Update lead
 * - DELETE /api/leads/{id} - Delete lead
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import type { LogLevel } from '@aws-lambda-powertools/logger/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    QueryCommand,
    ScanCommand
} from '@aws-sdk/lib-dynamodb';

// Initialize logger
const logger = new Logger({
    serviceName: 'api-leads',
    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
});

// LocalStack support
const awsEndpoint = process.env.AWS_ENDPOINT_URL;
const awsRegion = process.env.AWS_REGION || 'ap-south-1';

const clientConfig = awsEndpoint
    ? { region: awsRegion, endpoint: awsEndpoint }
    : { region: awsRegion };

// Initialize DynamoDB client (reused across warm invocations)
const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: { removeUndefinedValues: true },
});

const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || '';

/**
 * Lead status enum.
 */
type LeadStatus =
    | 'PENDING_IMPORT'
    | 'QUEUED'
    | 'VERIFIED'
    | 'SENT'
    | 'DELIVERED'
    | 'BOUNCED'
    | 'COMPLAINED'
    | 'SKIPPED';

/**
 * Lead document structure.
 */
interface Lead {
    id: string;
    fullName: string;
    email: string;
    companyName: string;
    phoneNumber?: string;
    leadType?: 'HARDWARE' | 'SOFTWARE' | 'BOTH';
    status: LeadStatus;
    campaignId?: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * API response helper.
 */
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

/**
 * Lambda handler for API Gateway events.
 */
export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    const { httpMethod, path, pathParameters, body } = event;

    logger.info('Handling request', { httpMethod, path });

    try {
        // Route based on method and path
        if (httpMethod === 'GET' && !pathParameters?.id) {
            return await listLeads(event);
        }

        if (httpMethod === 'GET' && pathParameters?.id) {
            return await getLead(pathParameters.id);
        }

        // Handle bulk-delete route
        if (httpMethod === 'POST' && path.endsWith('/bulk-delete')) {
            return await bulkDeleteLeads(body);
        }

        // Handle bulk-update route
        if (httpMethod === 'POST' && path.endsWith('/bulk-update')) {
            return await bulkUpdateLeads(body);
        }

        if (httpMethod === 'POST') {
            return await createLead(body);
        }

        if (httpMethod === 'PUT' && pathParameters?.id) {
            return await updateLead(pathParameters.id, body);
        }

        if (httpMethod === 'DELETE' && pathParameters?.id) {
            return await deleteLead(pathParameters.id);
        }

        return response(404, { success: false, message: 'Not found' });
    } catch (error) {
        logger.error('Request failed', { error });
        return response(500, {
            success: false,
            message: error instanceof Error ? error.message : 'Internal server error'
        });
    }
};

/**
 * List leads with pagination.
 */
async function listLeads(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const lastKey = event.queryStringParameters?.lastKey;

    const command = new ScanCommand({
        TableName: LEADS_TABLE,
        Limit: Math.min(limit, 100), // Cap at 100 for safety
        ...(lastKey && { ExclusiveStartKey: JSON.parse(Buffer.from(lastKey, 'base64').toString()) }),
    });

    const result = await docClient.send(command);

    return response(200, {
        success: true,
        data: result.Items,
        lastKey: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
            : null,
    });
}

/**
 * Get a single lead by ID.
 */
async function getLead(id: string): Promise<APIGatewayProxyResult> {
    const result = await docClient.send(new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id },
    }));

    if (!result.Item) {
        return response(404, { success: false, message: 'Lead not found' });
    }

    return response(200, { success: true, data: result.Item });
}

/**
 * Create a new lead.
 */
async function createLead(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);

    // Validate required fields
    if (!data.fullName?.trim()) {
        return response(400, { success: false, message: 'fullName is required' });
    }
    if (!data.email?.trim()) {
        return response(400, { success: false, message: 'email is required' });
    }
    if (!data.companyName?.trim()) {
        return response(400, { success: false, message: 'companyName is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
        return response(400, { success: false, message: 'Invalid email format' });
    }

    const now = new Date().toISOString();
    const lead: Lead = {
        id: crypto.randomUUID(),
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        companyName: data.companyName.trim(),
        phoneNumber: data.phoneNumber?.trim() || undefined,
        leadType: data.leadType || undefined,
        status: 'PENDING_IMPORT',
        createdAt: now,
        updatedAt: now,
    };

    await docClient.send(new PutCommand({
        TableName: LEADS_TABLE,
        Item: lead,
        ConditionExpression: 'attribute_not_exists(id)',
    }));

    logger.info('Lead created', { id: lead.id, email: lead.email });

    return response(201, { success: true, data: lead });
}

/**
 * Update an existing lead.
 */
async function updateLead(id: string, body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const now = new Date().toISOString();

    // Build update expression
    const updateParts: string[] = ['#updatedAt = :updatedAt'];
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, unknown> = { ':updatedAt': now };

    const allowedFields = ['fullName', 'email', 'companyName', 'phoneNumber', 'leadType', 'status'];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updateParts.push(`#${field} = :${field}`);
            names[`#${field}`] = field;
            values[`:${field}`] = data[field];
        }
    }

    const result = await docClient.send(new UpdateCommand({
        TableName: LEADS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(id)',
    }));

    logger.info('Lead updated', { id });

    return response(200, { success: true, data: result.Attributes });
}

/**
 * Delete a lead.
 */
async function deleteLead(id: string): Promise<APIGatewayProxyResult> {
    await docClient.send(new DeleteCommand({
        TableName: LEADS_TABLE,
        Key: { id },
        ConditionExpression: 'attribute_exists(id)',
    }));

    logger.info('Lead deleted', { id });

    return response(200, { success: true, message: 'Lead deleted' });
}

/**
 * Bulk delete leads by IDs.
 */
async function bulkDeleteLeads(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const { ids } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
        return response(400, { success: false, message: 'ids array is required' });
    }

    // Limit batch size for safety
    if (ids.length > 100) {
        return response(400, { success: false, message: 'Maximum 100 leads can be deleted at once' });
    }

    // Delete leads in parallel using Promise.all
    const deletePromises = ids.map((id: string) =>
        docClient.send(new DeleteCommand({
            TableName: LEADS_TABLE,
            Key: { id },
        })).catch(err => {
            logger.warn('Failed to delete lead', { id, error: err.message });
            return { failed: true, id, error: err.message };
        })
    );

    const results = await Promise.all(deletePromises);
    const failed = results.filter(r => r && 'failed' in r);
    const deletedCount = ids.length - failed.length;

    logger.info('Bulk delete completed', { deletedCount, failedCount: failed.length });

    return response(200, {
        success: true,
        data: {
            deletedCount,
            failedCount: failed.length,
            failed: failed.length > 0 ? failed : undefined,
        },
    });
}

/**
 * Bulk update leads by IDs.
 */
async function bulkUpdateLeads(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return response(400, { success: false, message: 'Request body required' });
    }

    const data = JSON.parse(body);
    const { ids, updates } = data;

    if (!Array.isArray(ids) || ids.length === 0) {
        return response(400, { success: false, message: 'ids array is required' });
    }

    if (!updates || typeof updates !== 'object') {
        return response(400, { success: false, message: 'updates object is required' });
    }

    // Limit batch size for safety
    if (ids.length > 100) {
        return response(400, { success: false, message: 'Maximum 100 leads can be updated at once' });
    }

    // Validate allowed update fields
    const allowedUpdateFields = ['status', 'campaignId'];
    const invalidFields = Object.keys(updates).filter(key => !allowedUpdateFields.includes(key));
    if (invalidFields.length > 0) {
        return response(400, { success: false, message: `Invalid update fields: ${invalidFields.join(', ')}` });
    }

    // Validate status if provided
    const validStatuses = ['PENDING_IMPORT', 'QUEUED', 'VERIFIED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SKIPPED'];
    if (updates.status && !validStatuses.includes(updates.status)) {
        return response(400, { success: false, message: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
    }

    const now = new Date().toISOString();
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    // Update leads in parallel
    const updatePromises = ids.map((id: string) => {
        // Build update expression
        const updateParts: string[] = ['#updatedAt = :updatedAt'];
        const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
        const values: Record<string, unknown> = { ':updatedAt': now };

        for (const field of allowedUpdateFields) {
            if (updates[field] !== undefined) {
                updateParts.push(`#${field} = :${field}`);
                names[`#${field}`] = field;
                values[`:${field}`] = updates[field];
            }
        }

        return docClient.send(new UpdateCommand({
            TableName: LEADS_TABLE,
            Key: { id },
            UpdateExpression: `SET ${updateParts.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: 'attribute_exists(id)',
        })).then(() => ({ id, success: true }))
          .catch(err => {
            logger.warn('Failed to update lead', { id, error: err.message });
            return { id, success: false, error: err.message };
          });
    });

    const updateResults = await Promise.all(updatePromises);
    const succeeded = updateResults.filter(r => r.success);
    const failed = updateResults.filter(r => !r.success);

    logger.info('Bulk update completed', { updatedCount: succeeded.length, failedCount: failed.length });

    return response(200, {
        success: true,
        data: {
            updatedCount: succeeded.length,
            failedCount: failed.length,
            details: updateResults,
        },
    });
}
