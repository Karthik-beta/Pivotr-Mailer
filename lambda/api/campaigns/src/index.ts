/**
 * API Campaigns Lambda
 * 
 * Handles Campaign CRUD operations.
 * Routes: GET, POST, PUT, DELETE for /api/campaigns
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const logger = new Logger({
    serviceName: 'api-campaigns',
    logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
});

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

const CAMPAIGNS_TABLE = process.env.DYNAMODB_TABLE_CAMPAIGNS || '';

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    const { httpMethod, pathParameters, body } = event;
    const id = pathParameters?.id;

    try {
        if (httpMethod === 'GET') {
            if (id) return await getCampaign(id);
            return await listCampaigns();
        }

        if (httpMethod === 'POST') {
            return await createCampaign(body);
        }

        if (httpMethod === 'PUT' && id) {
            return await updateCampaign(id, body);
        }

        if (httpMethod === 'DELETE' && id) {
            return await deleteCampaign(id);
        }

        return response(405, { message: 'Method Not Allowed' });
    } catch (error) {
        logger.error('Error handling request', { error });
        return response(500, { message: 'Internal Server Error' });
    }
};

async function listCampaigns() {
    // Naive scan for now. Pagination should be added similar to leads.
    const result = await docClient.send(new ScanCommand({ TableName: CAMPAIGNS_TABLE }));
    return response(200, { success: true, data: result.Items });
}

async function getCampaign(id: string) {
    const result = await docClient.send(new GetCommand({
        TableName: CAMPAIGNS_TABLE,
        Key: { id }
    }));
    if (!result.Item) return response(404, { message: 'Not Found' });
    return response(200, { success: true, data: result.Item });
}

async function createCampaign(body: string | null) {
    if (!body) return response(400, { message: 'Missing body' });
    const data = JSON.parse(body);

    // Validate
    if (!data.name) return response(400, { message: 'Name is required' });

    const item = {
        id: crypto.randomUUID(),
        name: data.name,
        subjectTemplate: data.subjectTemplate || '',
        bodyTemplate: data.bodyTemplate || '',
        status: 'DRAFT', // DEFAULT
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data
    };

    await docClient.send(new PutCommand({
        TableName: CAMPAIGNS_TABLE,
        Item: item
    }));

    return response(201, { success: true, data: item });
}

async function updateCampaign(id: string, body: string | null) {
    if (!body) return response(400, { message: 'Missing body' });
    const data = JSON.parse(body);

    // Example partial update logic (simplified)
    // In real app, build expression dynamically
    const updateParts: string[] = ['#updatedAt = :updatedAt'];
    const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const values: Record<string, any> = { ':updatedAt': new Date().toISOString() };

    const allowed = ['name', 'subjectTemplate', 'bodyTemplate', 'status'];
    for (const key of allowed) {
        if (data[key] !== undefined) {
            updateParts.push(`#${key} = :${key}`);
            names[`#${key}`] = key;
            values[`:${key}`] = data[key];
        }
    }

    await docClient.send(new UpdateCommand({
        TableName: CAMPAIGNS_TABLE,
        Key: { id },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }));

    return response(200, { success: true });
}

async function deleteCampaign(id: string) {
    await docClient.send(new DeleteCommand({
        TableName: CAMPAIGNS_TABLE,
        Key: { id }
    }));
    return response(200, { success: true });
}

function response(statusCode: number, body: any) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body)
    };
}
