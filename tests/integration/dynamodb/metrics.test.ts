/**
 * Integration Tests: Metrics Table Operations
 *
 * Tests the metrics tracking system for daily caps and statistics.
 * Critical for reputation management and safety controls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { insertMetrics, getMetrics, clearMetricsTable } from '../../utils/dynamodb-helpers.js';
import { getDocumentClient, getTableNames } from '../../utils/aws-clients.js';
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const docClient = getDocumentClient();
const tables = getTableNames();

describe('Metrics Table Integration Tests', () => {
    beforeEach(async () => {
        await clearMetricsTable();
    });

    describe('Daily Metrics Tracking', () => {
        it('should create daily metrics record', async () => {
            const today = new Date().toISOString().split('T')[0];

            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 0,
                bounces: 0,
                complaints: 0,
                deliveries: 0,
            });

            const metrics = await getMetrics('GLOBAL', today);

            expect(metrics).toBeDefined();
            expect(metrics?.pk).toBe('GLOBAL');
            expect(metrics?.sk).toBe(today);
            expect(metrics?.sentCount).toBe(0);
        });

        it('should increment sent count atomically', async () => {
            const today = new Date().toISOString().split('T')[0];

            // Initialize
            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 0,
            });

            // Increment
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'GLOBAL', sk: today },
                    UpdateExpression: 'ADD sentCount :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                })
            );

            const metrics = await getMetrics('GLOBAL', today);
            expect(metrics?.sentCount).toBe(1);
        });

        it('should increment multiple counters atomically', async () => {
            const today = new Date().toISOString().split('T')[0];

            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 100,
                bounces: 5,
                complaints: 0,
                deliveries: 95,
            });

            // Simulate processing a batch with mixed results
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'GLOBAL', sk: today },
                    UpdateExpression: 'ADD sentCount :sent, bounces :bounces, deliveries :delivered',
                    ExpressionAttributeValues: {
                        ':sent': 10,
                        ':bounces': 1,
                        ':delivered': 9,
                    },
                })
            );

            const metrics = await getMetrics('GLOBAL', today);
            expect(metrics?.sentCount).toBe(110);
            expect(metrics?.bounces).toBe(6);
            expect(metrics?.deliveries).toBe(104);
        });

        it('should handle concurrent increments', async () => {
            const today = new Date().toISOString().split('T')[0];

            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 0,
            });

            // Simulate concurrent increments
            await Promise.all([
                docClient.send(
                    new UpdateCommand({
                        TableName: tables.metrics,
                        Key: { pk: 'GLOBAL', sk: today },
                        UpdateExpression: 'ADD sentCount :inc',
                        ExpressionAttributeValues: { ':inc': 1 },
                    })
                ),
                docClient.send(
                    new UpdateCommand({
                        TableName: tables.metrics,
                        Key: { pk: 'GLOBAL', sk: today },
                        UpdateExpression: 'ADD sentCount :inc',
                        ExpressionAttributeValues: { ':inc': 1 },
                    })
                ),
                docClient.send(
                    new UpdateCommand({
                        TableName: tables.metrics,
                        Key: { pk: 'GLOBAL', sk: today },
                        UpdateExpression: 'ADD sentCount :inc',
                        ExpressionAttributeValues: { ':inc': 1 },
                    })
                ),
            ]);

            const metrics = await getMetrics('GLOBAL', today);
            expect(metrics?.sentCount).toBe(3);
        });
    });

    describe('Campaign-Specific Metrics', () => {
        it('should track metrics per campaign', async () => {
            const today = new Date().toISOString().split('T')[0];
            const campaignId = 'campaign-123';

            await insertMetrics({
                pk: `CAMPAIGN#${campaignId}`,
                sk: today,
                sentCount: 50,
                bounces: 2,
                complaints: 0,
                deliveries: 48,
            });

            const metrics = await getMetrics(`CAMPAIGN#${campaignId}`, today);

            expect(metrics?.sentCount).toBe(50);
            expect(metrics?.bounces).toBe(2);
        });

        it('should query metrics for a campaign over time', async () => {
            const campaignId = 'campaign-history';
            const dates = ['2024-01-01', '2024-01-02', '2024-01-03'];

            // Insert metrics for multiple days
            for (const date of dates) {
                await insertMetrics({
                    pk: `CAMPAIGN#${campaignId}`,
                    sk: date,
                    sentCount: 100,
                    deliveries: 95,
                    bounces: 5,
                });
            }

            // Query all metrics for campaign
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.metrics,
                    KeyConditionExpression: 'pk = :pk',
                    ExpressionAttributeValues: {
                        ':pk': `CAMPAIGN#${campaignId}`,
                    },
                })
            );

            expect(result.Items).toHaveLength(3);

            // Calculate totals
            const totalSent = result.Items?.reduce((sum, item) => sum + (item.sentCount || 0), 0);
            expect(totalSent).toBe(300);
        });

        it('should query metrics for date range', async () => {
            const campaignId = 'campaign-range';

            // Insert metrics for a week
            const dates = [
                '2024-01-01', '2024-01-02', '2024-01-03',
                '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07',
            ];

            for (const date of dates) {
                await insertMetrics({
                    pk: `CAMPAIGN#${campaignId}`,
                    sk: date,
                    sentCount: 50,
                });
            }

            // Query for first 3 days only
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.metrics,
                    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
                    ExpressionAttributeValues: {
                        ':pk': `CAMPAIGN#${campaignId}`,
                        ':start': '2024-01-01',
                        ':end': '2024-01-03',
                    },
                })
            );

            expect(result.Items).toHaveLength(3);
        });
    });

    describe('Daily Cap Check', () => {
        it('should check and increment daily cap atomically', async () => {
            const today = new Date().toISOString().split('T')[0];
            const DAILY_CAP = 500;

            // Initialize at cap - 1
            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: DAILY_CAP - 1,
            });

            // Check and increment (what Lambda does)
            const result = await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'GLOBAL', sk: today },
                    UpdateExpression: 'ADD sentCount :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                    ReturnValues: 'UPDATED_NEW',
                })
            );

            const newCount = result.Attributes?.sentCount;
            expect(newCount).toBe(DAILY_CAP);

            // Next increment would exceed cap
            const secondResult = await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'GLOBAL', sk: today },
                    UpdateExpression: 'ADD sentCount :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                    ReturnValues: 'UPDATED_NEW',
                })
            );

            expect(secondResult.Attributes?.sentCount).toBe(DAILY_CAP + 1);
        });

        it('should create metrics record if not exists', async () => {
            const today = new Date().toISOString().split('T')[0];

            // ADD creates attribute if it doesn't exist
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'NEW_GLOBAL', sk: today },
                    UpdateExpression: 'ADD sentCount :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                })
            );

            const metrics = await getMetrics('NEW_GLOBAL', today);
            expect(metrics?.sentCount).toBe(1);
        });
    });

    describe('Reputation Metrics', () => {
        it('should calculate rates from metrics', async () => {
            const today = new Date().toISOString().split('T')[0];

            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 1000,
                bounces: 50,
                complaints: 1,
                deliveries: 949,
            });

            const metrics = await getMetrics('GLOBAL', today);

            const bounceRate = (metrics?.bounces || 0) / (metrics?.sentCount || 1);
            const complaintRate = (metrics?.complaints || 0) / (metrics?.sentCount || 1);
            const deliveryRate = (metrics?.deliveries || 0) / (metrics?.sentCount || 1);

            expect(bounceRate).toBe(0.05); // 5%
            expect(complaintRate).toBe(0.001); // 0.1%
            expect(deliveryRate).toBe(0.949); // 94.9%
        });

        it('should track reputation thresholds', async () => {
            const today = new Date().toISOString().split('T')[0];
            const MAX_BOUNCE_RATE = 0.05;
            const MAX_COMPLAINT_RATE = 0.001;

            // Scenario: High bounce rate
            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 100,
                bounces: 6, // 6% - over threshold
                complaints: 0,
                deliveries: 94,
            });

            const metrics = await getMetrics('GLOBAL', today);
            const bounceRate = (metrics?.bounces || 0) / (metrics?.sentCount || 1);

            const isReputationAtRisk = bounceRate > MAX_BOUNCE_RATE;
            expect(isReputationAtRisk).toBe(true);
        });
    });

    describe('Metrics Isolation', () => {
        it('should isolate global and campaign metrics', async () => {
            const today = new Date().toISOString().split('T')[0];

            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 500,
            });

            await insertMetrics({
                pk: 'CAMPAIGN#camp-1',
                sk: today,
                sentCount: 200,
            });

            await insertMetrics({
                pk: 'CAMPAIGN#camp-2',
                sk: today,
                sentCount: 300,
            });

            const globalMetrics = await getMetrics('GLOBAL', today);
            const camp1Metrics = await getMetrics('CAMPAIGN#camp-1', today);
            const camp2Metrics = await getMetrics('CAMPAIGN#camp-2', today);

            expect(globalMetrics?.sentCount).toBe(500);
            expect(camp1Metrics?.sentCount).toBe(200);
            expect(camp2Metrics?.sentCount).toBe(300);
        });
    });
});
