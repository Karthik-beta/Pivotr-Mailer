/**
 * DynamoDB Client
 * 
 * Centralized DynamoDB client with document abstraction.
 * Reuses connections across Lambda invocations (warm starts).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let documentClient: DynamoDBDocumentClient | null = null;

/**
 * Get or create the DynamoDB Document Client.
 * Client is cached for connection reuse across warm invocations.
 */
export function getDynamoDbClient(): DynamoDBDocumentClient {
    if (!documentClient) {
        const client = new DynamoDBClient({
            region: process.env.AWS_REGION || 'ap-south-1',
        });

        documentClient = DynamoDBDocumentClient.from(client, {
            marshallOptions: {
                removeUndefinedValues: true,
                convertEmptyValues: false,
            },
            unmarshallOptions: {
                wrapNumbers: false,
            },
        });
    }

    return documentClient;
}

/**
 * Reset the client (useful for testing).
 */
export function resetDynamoDbClient(): void {
    documentClient = null;
}
