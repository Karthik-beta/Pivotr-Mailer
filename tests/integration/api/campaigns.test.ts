/**
 * Integration Tests: Campaigns API
 *
 * Tests Campaign CRUD operations against LocalStack DynamoDB.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createCampaign } from '../../utils/fixtures.js';
import {
    insertCampaign,
    getCampaign,
    clearCampaignsTable,
} from '../../utils/dynamodb-helpers.js';
import { getDocumentClient, getTableNames } from '../../utils/aws-clients.js';
import { UpdateCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const docClient = getDocumentClient();
const tables = getTableNames();

describe('Campaigns API Integration Tests', () => {
    beforeEach(async () => {
        await clearCampaignsTable();
    });

    describe('CRUD Operations', () => {
        it('should create a campaign', async () => {
            const campaign = createCampaign({
                name: 'Test Campaign',
                subject: 'Hello {firstName}!',
                status: 'DRAFT',
            });

            await insertCampaign(campaign);

            const retrieved = await getCampaign(campaign.id);
            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('Test Campaign');
            expect(retrieved?.subject).toBe('Hello {firstName}!');
            expect(retrieved?.status).toBe('DRAFT');
        });

        it('should update campaign status', async () => {
            const campaign = createCampaign({ status: 'DRAFT' });
            await insertCampaign(campaign);

            // Update to SCHEDULED
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET #status = :status, scheduledAt = :scheduledAt',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'SCHEDULED',
                        ':scheduledAt': new Date().toISOString(),
                    },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.status).toBe('SCHEDULED');
            expect(updated?.scheduledAt).toBeDefined();
        });

        it('should delete a campaign', async () => {
            const campaign = createCampaign();
            await insertCampaign(campaign);

            // Verify exists
            let retrieved = await getCampaign(campaign.id);
            expect(retrieved).toBeDefined();

            // Delete
            await docClient.send(
                new DeleteCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                })
            );

            // Verify deleted
            retrieved = await getCampaign(campaign.id);
            expect(retrieved).toBeUndefined();
        });

        it('should list all campaigns', async () => {
            // Create multiple campaigns
            const campaigns = [
                createCampaign({ name: 'Campaign 1', status: 'DRAFT' }),
                createCampaign({ name: 'Campaign 2', status: 'RUNNING' }),
                createCampaign({ name: 'Campaign 3', status: 'COMPLETED' }),
            ];

            for (const campaign of campaigns) {
                await insertCampaign(campaign);
            }

            // Scan all
            const result = await docClient.send(
                new ScanCommand({
                    TableName: tables.campaigns,
                })
            );

            expect(result.Items).toHaveLength(3);
        });
    });

    describe('Campaign Status Transitions', () => {
        it('should allow DRAFT to SCHEDULED', async () => {
            const campaign = createCampaign({ status: 'DRAFT' });
            await insertCampaign(campaign);

            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET #status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'SCHEDULED' },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.status).toBe('SCHEDULED');
        });

        it('should allow SCHEDULED to RUNNING', async () => {
            const campaign = createCampaign({ status: 'SCHEDULED' });
            await insertCampaign(campaign);

            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET #status = :status, startedAt = :startedAt',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'RUNNING',
                        ':startedAt': new Date().toISOString(),
                    },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.status).toBe('RUNNING');
            expect(updated?.startedAt).toBeDefined();
        });

        it('should allow RUNNING to PAUSED', async () => {
            const campaign = createCampaign({ status: 'RUNNING' });
            await insertCampaign(campaign);

            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET #status = :status',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':status': 'PAUSED' },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.status).toBe('PAUSED');
        });

        it('should allow RUNNING to PAUSED_REPUTATION_RISK', async () => {
            const campaign = createCampaign({ status: 'RUNNING' });
            await insertCampaign(campaign);

            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET #status = :status, pauseReason = :reason',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'PAUSED_REPUTATION_RISK',
                        ':reason': 'Bounce rate exceeded 5%',
                    },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.status).toBe('PAUSED_REPUTATION_RISK');
            expect((updated as any).pauseReason).toBe('Bounce rate exceeded 5%');
        });
    });

    describe('Campaign Statistics', () => {
        it('should track campaign sending statistics', async () => {
            const campaign = createCampaign({ status: 'RUNNING' });
            await insertCampaign(campaign);

            // Simulate updating stats
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'SET totalLeads = :total, sentCount = :sent, deliveredCount = :delivered',
                    ExpressionAttributeValues: {
                        ':total': 1000,
                        ':sent': 500,
                        ':delivered': 480,
                    },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.totalLeads).toBe(1000);
            expect(updated?.sentCount).toBe(500);
            expect(updated?.deliveredCount).toBe(480);
        });

        it('should increment counters atomically', async () => {
            const campaign = createCampaign({ status: 'RUNNING' });
            (campaign as any).sentCount = 0;
            await insertCampaign(campaign);

            // Atomic increment
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.campaigns,
                    Key: { id: campaign.id },
                    UpdateExpression: 'ADD sentCount :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                })
            );

            const updated = await getCampaign(campaign.id);
            expect(updated?.sentCount).toBe(1);
        });
    });
});
