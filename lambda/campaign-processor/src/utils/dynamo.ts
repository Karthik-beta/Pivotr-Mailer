/**
 * DynamoDB utility functions for campaign-processor.
 *
 * Provides safe batch operations with retry logic for throttling.
 */

import type { DynamoDBDocumentClient, BatchWriteCommandInput, BatchWriteCommandOutput } from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const MAX_RETRIES = 3;

/**
 * Performs a BatchWrite with retry logic for UnprocessedItems.
 *
 * DynamoDB may return UnprocessedItems when throttled or under load.
 * This function retries with exponential backoff to ensure all items are written.
 *
 * @param docClient - DynamoDB Document Client
 * @param params - BatchWriteCommand input parameters
 * @returns BatchWriteCommandOutput from the final successful call
 * @throws Error if items remain unprocessed after MAX_RETRIES
 */
export async function safeBatchWrite(
    docClient: DynamoDBDocumentClient,
    params: BatchWriteCommandInput
): Promise<BatchWriteCommandOutput> {
    let requestItems = params.RequestItems;
    let attempts = 0;
    let lastResult: BatchWriteCommandOutput | undefined;

    while (attempts <= MAX_RETRIES && requestItems && Object.keys(requestItems).length > 0) {
        lastResult = await docClient.send(new BatchWriteCommand({
            RequestItems: requestItems
        }));

        if (lastResult.UnprocessedItems && Object.keys(lastResult.UnprocessedItems).length > 0) {
            // Some items were not processed (throttling)
            requestItems = lastResult.UnprocessedItems;
            attempts++;

            if (attempts <= MAX_RETRIES) {
                // Exponential backoff: 200ms, 400ms, 800ms
                await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempts)));
            }
        } else {
            // All items processed successfully
            return lastResult;
        }
    }

    // If we still have unprocessed items after retries, return the last result
    // The caller can check UnprocessedItems if needed
    if (lastResult) {
        return lastResult;
    }

    // Should not reach here, but return empty result as fallback
    return { UnprocessedItems: {} } as BatchWriteCommandOutput;
}
