/**
 * DynamoDB Test Helpers
 *
 * Utilities for managing DynamoDB data in integration tests.
 */

import { DeleteCommand, PutCommand, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getDocumentClient, getTableNames } from './aws-clients.js';
import type { Lead, Campaign } from './fixtures.js';

const docClient = getDocumentClient();
const tables = getTableNames();

// =============================================================================
// Leads Table Helpers
// =============================================================================

/**
 * Insert a lead into DynamoDB
 */
export async function insertLead(lead: Lead): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: tables.leads,
            Item: lead,
        })
    );
}

/**
 * Insert multiple leads into DynamoDB
 */
export async function insertLeads(leads: Lead[]): Promise<void> {
    // DynamoDB batch write limit is 25 items
    const batches = chunkArray(leads, 25);

    for (const batch of batches) {
        await docClient.send(
            new BatchWriteCommand({
                RequestItems: {
                    [tables.leads]: batch.map((lead) => ({
                        PutRequest: { Item: lead },
                    })),
                },
            })
        );
    }
}

/**
 * Get a lead by ID
 */
export async function getLead(id: string): Promise<Lead | undefined> {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(
        new GetCommand({
            TableName: tables.leads,
            Key: { id },
        })
    );
    return result.Item as Lead | undefined;
}

/**
 * Delete a lead by ID
 */
export async function deleteLead(id: string): Promise<void> {
    await docClient.send(
        new DeleteCommand({
            TableName: tables.leads,
            Key: { id },
        })
    );
}

/**
 * Clear all leads from the table
 */
export async function clearLeadsTable(): Promise<void> {
    await clearTable(tables.leads, ['id']);
}

// =============================================================================
// Campaigns Table Helpers
// =============================================================================

/**
 * Insert a campaign into DynamoDB
 */
export async function insertCampaign(campaign: Campaign): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: tables.campaigns,
            Item: campaign,
        })
    );
}

/**
 * Get a campaign by ID
 */
export async function getCampaign(id: string): Promise<Campaign | undefined> {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(
        new GetCommand({
            TableName: tables.campaigns,
            Key: { id },
        })
    );
    return result.Item as Campaign | undefined;
}

/**
 * Clear all campaigns from the table
 */
export async function clearCampaignsTable(): Promise<void> {
    await clearTable(tables.campaigns, ['id']);
}

// =============================================================================
// Metrics Table Helpers
// =============================================================================

export interface MetricsRecord {
    pk: string;
    sk: string;
    sentCount?: number;
    bounces?: number;
    complaints?: number;
    deliveries?: number;
    [key: string]: unknown;
}

/**
 * Insert a metrics record
 */
export async function insertMetrics(record: MetricsRecord): Promise<void> {
    await docClient.send(
        new PutCommand({
            TableName: tables.metrics,
            Item: record,
        })
    );
}

/**
 * Get metrics for a specific date
 */
export async function getMetrics(pk: string, sk: string): Promise<MetricsRecord | undefined> {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const result = await docClient.send(
        new GetCommand({
            TableName: tables.metrics,
            Key: { pk, sk },
        })
    );
    return result.Item as MetricsRecord | undefined;
}

/**
 * Clear all metrics from the table
 */
export async function clearMetricsTable(): Promise<void> {
    await clearTable(tables.metrics, ['pk', 'sk']);
}

// =============================================================================
// Generic Helpers
// =============================================================================

/**
 * Clear all items from a DynamoDB table
 * Uses expression attribute names to handle reserved keywords
 */
async function clearTable(tableName: string, keyAttributes: string[]): Promise<void> {
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    // Build expression attribute names to handle reserved keywords
    const expressionAttributeNames: Record<string, string> = {};
    const projectionParts: string[] = [];
    for (const attr of keyAttributes) {
        const placeholder = `#${attr}`;
        expressionAttributeNames[placeholder] = attr;
        projectionParts.push(placeholder);
    }

    do {
        const scanResult = await docClient.send(
            new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastEvaluatedKey,
                ProjectionExpression: projectionParts.join(', '),
                ExpressionAttributeNames: expressionAttributeNames,
            })
        );

        if (scanResult.Items && scanResult.Items.length > 0) {
            const batches = chunkArray(scanResult.Items, 25);

            for (const batch of batches) {
                await docClient.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [tableName]: batch.map((item) => ({
                                DeleteRequest: {
                                    Key: Object.fromEntries(
                                        keyAttributes.map((attr) => [attr, item[attr]])
                                    ),
                                },
                            })),
                        },
                    })
                );
            }
        }

        lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
}

/**
 * Clear all tables
 */
export async function clearAllTables(): Promise<void> {
    await Promise.all([
        clearLeadsTable(),
        clearCampaignsTable(),
        clearMetricsTable(),
        clearTable(tables.logs, ['campaignId', 'timestamp']),
        clearTable(tables.settings, ['key']),
    ]);
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
