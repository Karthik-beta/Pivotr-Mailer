/**
 * Integration Tests: DynamoDB GSI Queries
 *
 * Tests Global Secondary Index queries for leads table.
 * GSIs are critical for efficient lead filtering and campaign management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLead, createLeads } from '../../utils/fixtures.js';
import { insertLead, insertLeads, clearLeadsTable } from '../../utils/dynamodb-helpers.js';
import { getDocumentClient, getTableNames } from '../../utils/aws-clients.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const docClient = getDocumentClient();
const tables = getTableNames();

describe('DynamoDB GSI Queries', () => {
    beforeEach(async () => {
        await clearLeadsTable();
    });

    describe('EmailIndex GSI', () => {
        it('should find lead by email', async () => {
            const lead = createLead({ email: 'unique@example.com' });
            await insertLead(lead);

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'EmailIndex',
                    KeyConditionExpression: 'email = :email',
                    ExpressionAttributeValues: {
                        ':email': 'unique@example.com',
                    },
                })
            );

            expect(result.Items).toHaveLength(1);
            expect(result.Items?.[0].id).toBe(lead.id);
        });

        it('should return empty for non-existent email', async () => {
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'EmailIndex',
                    KeyConditionExpression: 'email = :email',
                    ExpressionAttributeValues: {
                        ':email': 'nonexistent@example.com',
                    },
                })
            );

            expect(result.Items).toHaveLength(0);
        });

        it('should detect duplicate emails', async () => {
            const email = 'duplicate@example.com';

            // Insert two leads with same email (simulating potential duplicates)
            const lead1 = createLead({ email });
            const lead2 = createLead({ email });

            await insertLead(lead1);
            await insertLead(lead2);

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'EmailIndex',
                    KeyConditionExpression: 'email = :email',
                    ExpressionAttributeValues: {
                        ':email': email,
                    },
                })
            );

            expect(result.Items).toHaveLength(2);
        });
    });

    describe('StatusIndex GSI', () => {
        it('should find leads by status', async () => {
            // Create leads with different statuses
            const queuedLead = createLead({ status: 'QUEUED' });
            const sentLead = createLead({ status: 'SENT' });
            const deliveredLead = createLead({ status: 'DELIVERED' });

            await insertLeads([queuedLead, sentLead, deliveredLead]);

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'StatusIndex',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'QUEUED',
                    },
                })
            );

            expect(result.Items).toHaveLength(1);
            expect(result.Items?.[0].id).toBe(queuedLead.id);
        });

        it('should count leads by status', async () => {
            // Create multiple leads with same status
            const leads = [
                createLead({ status: 'SENT' }),
                createLead({ status: 'SENT' }),
                createLead({ status: 'SENT' }),
                createLead({ status: 'DELIVERED' }),
                createLead({ status: 'BOUNCED' }),
            ];

            await insertLeads(leads);

            const sentResult = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'StatusIndex',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'SENT' },
                    Select: 'COUNT',
                })
            );

            expect(sentResult.Count).toBe(3);
        });

        it('should find all bounced leads', async () => {
            const leads = [
                createLead({ status: 'BOUNCED', email: 'bounce1@example.com' }),
                createLead({ status: 'BOUNCED', email: 'bounce2@example.com' }),
                createLead({ status: 'DELIVERED', email: 'good@example.com' }),
            ];

            await insertLeads(leads);

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'StatusIndex',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'BOUNCED' },
                })
            );

            expect(result.Items).toHaveLength(2);
            expect(result.Items?.every((item) => item.status === 'BOUNCED')).toBe(true);
        });
    });

    describe('CampaignIndex GSI', () => {
        it('should find leads by campaign', async () => {
            const campaignId = 'campaign-123';

            const leads = [
                createLead({ campaignId, status: 'QUEUED' }),
                createLead({ campaignId, status: 'SENT' }),
                createLead({ campaignId: 'other-campaign', status: 'QUEUED' }),
            ];

            await insertLeads(leads);

            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'CampaignIndex',
                    KeyConditionExpression: 'campaignId = :campaignId',
                    ExpressionAttributeValues: {
                        ':campaignId': campaignId,
                    },
                })
            );

            expect(result.Items).toHaveLength(2);
            expect(result.Items?.every((item) => item.campaignId === campaignId)).toBe(true);
        });

        it('should filter campaign leads by status (composite key)', async () => {
            const campaignId = 'campaign-456';

            const leads = [
                createLead({ campaignId, status: 'QUEUED' }),
                createLead({ campaignId, status: 'QUEUED' }),
                createLead({ campaignId, status: 'SENT' }),
                createLead({ campaignId, status: 'DELIVERED' }),
            ];

            await insertLeads(leads);

            // Query with both partition key and sort key
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'CampaignIndex',
                    KeyConditionExpression: 'campaignId = :campaignId AND #status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':campaignId': campaignId,
                        ':status': 'QUEUED',
                    },
                })
            );

            expect(result.Items).toHaveLength(2);
            expect(result.Items?.every((item) => item.status === 'QUEUED')).toBe(true);
        });

        it('should get campaign statistics', async () => {
            const campaignId = 'campaign-stats';

            const leads = [
                createLead({ campaignId, status: 'QUEUED' }),
                createLead({ campaignId, status: 'QUEUED' }),
                createLead({ campaignId, status: 'SENT' }),
                createLead({ campaignId, status: 'SENT' }),
                createLead({ campaignId, status: 'SENT' }),
                createLead({ campaignId, status: 'DELIVERED' }),
                createLead({ campaignId, status: 'DELIVERED' }),
                createLead({ campaignId, status: 'BOUNCED' }),
            ];

            await insertLeads(leads);

            // Get counts for each status
            const statuses = ['QUEUED', 'SENT', 'DELIVERED', 'BOUNCED'];
            const counts: Record<string, number> = {};

            for (const status of statuses) {
                const result = await docClient.send(
                    new QueryCommand({
                        TableName: tables.leads,
                        IndexName: 'CampaignIndex',
                        KeyConditionExpression: 'campaignId = :campaignId AND #status = :status',
                        ExpressionAttributeNames: { '#status': 'status' },
                        ExpressionAttributeValues: {
                            ':campaignId': campaignId,
                            ':status': status,
                        },
                        Select: 'COUNT',
                    })
                );
                counts[status] = result.Count || 0;
            }

            expect(counts.QUEUED).toBe(2);
            expect(counts.SENT).toBe(3);
            expect(counts.DELIVERED).toBe(2);
            expect(counts.BOUNCED).toBe(1);
        });
    });

    describe('GSI Pagination', () => {
        it('should paginate through large result sets', async () => {
            // Create many leads with same status
            const leads = Array.from({ length: 30 }, (_, i) =>
                createLead({
                    email: `user${i}@example.com`,
                    status: 'PENDING_IMPORT',
                })
            );

            await insertLeads(leads);

            // Query with limit
            const firstPage = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'StatusIndex',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'PENDING_IMPORT' },
                    Limit: 10,
                })
            );

            expect(firstPage.Items).toHaveLength(10);
            expect(firstPage.LastEvaluatedKey).toBeDefined();

            // Get second page
            const secondPage = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'StatusIndex',
                    KeyConditionExpression: '#status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'PENDING_IMPORT' },
                    Limit: 10,
                    ExclusiveStartKey: firstPage.LastEvaluatedKey,
                })
            );

            expect(secondPage.Items).toHaveLength(10);
        });
    });
});
