/**
 * API Metrics Lambda
 * 
 * Aggregates and returns dashboard metrics.
 * Route: GET /api/metrics
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const logger = new Logger({
    serviceName: 'api-metrics',
    logLevel: (process.env.LOG_LEVEL as any) || 'INFO',
});

// Clients
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const METRICS_TABLE = process.env.DYNAMODB_TABLE_METRICS || '';

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    const { queryStringParameters } = event;
    const range = queryStringParameters?.range || 'today'; // 'today', '7d', '30d'

    try {
        // TODO: Implement sophisticated range querying.
        // For now, fetch 'GLOBAL#<Today>' stats.
        const today = new Date().toISOString().split('T')[0];

        const result = await docClient.send(new GetCommand({
            TableName: METRICS_TABLE,
            Key: { pk: 'GLOBAL', sk: today }
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                success: true,
                data: result.Item || {
                    sentCount: 0,
                    bounces: 0,
                    complaints: 0,
                    deliveries: 0
                }
            })
        };
    } catch (error) {
        logger.error('Failed to get metrics', { error });
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };
    }
};
