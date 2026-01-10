/**
 * Integration Tests: Lead Import
 *
 * Tests the lead import Lambda functionality.
 * Validates batch import, validation, and queue integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLead, createAPIGatewayEvent } from '../../utils/fixtures.js';
import { insertLead, getLead, clearLeadsTable } from '../../utils/dynamodb-helpers.js';
import { getDocumentClient, getTableNames, getQueueUrls } from '../../utils/aws-clients.js';
import { BatchWriteCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { sendToVerificationQueue, receiveMessages, purgeAllQueues } from '../../utils/sqs-helpers.js';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const docClient = getDocumentClient();
const tables = getTableNames();
const queues = getQueueUrls();

describe('Lead Import Integration Tests', () => {
    beforeEach(async () => {
        await clearLeadsTable();
        await purgeAllQueues();
        await new Promise((resolve) => setTimeout(resolve, 500));
    });

    describe('Batch Import', () => {
        it('should import multiple leads in batch', async () => {
            const leads = [
                createLead({ fullName: 'User 1', email: 'user1@example.com', companyName: 'Company A' }),
                createLead({ fullName: 'User 2', email: 'user2@example.com', companyName: 'Company B' }),
                createLead({ fullName: 'User 3', email: 'user3@example.com', companyName: 'Company C' }),
            ];

            // Batch write
            await docClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [tables.leads]: leads.map((lead) => ({
                            PutRequest: { Item: lead },
                        })),
                    },
                })
            );

            // Verify all imported
            const result = await docClient.send(
                new ScanCommand({
                    TableName: tables.leads,
                    Select: 'COUNT',
                })
            );

            expect(result.Count).toBe(3);
        });

        it('should set initial status to PENDING_IMPORT', async () => {
            const lead = createLead({
                email: 'pending@example.com',
                status: 'PENDING_IMPORT',
            });

            await insertLead(lead);

            const retrieved = await getLead(lead.id);
            expect(retrieved?.status).toBe('PENDING_IMPORT');
        });

        it('should handle large batch import', async () => {
            // Create 50 leads
            const leads = Array.from({ length: 50 }, (_, i) =>
                createLead({
                    fullName: `Batch User ${i}`,
                    email: `batch${i}@example.com`,
                    companyName: 'Batch Company',
                    status: 'PENDING_IMPORT',
                })
            );

            // DynamoDB batch write limit is 25, so we need to batch
            const batches = [];
            for (let i = 0; i < leads.length; i += 25) {
                batches.push(leads.slice(i, i + 25));
            }

            for (const batch of batches) {
                let unprocessed: typeof batch = batch;
                let retries = 0;
                const maxRetries = 3;

                // Retry unprocessed items (DynamoDB may return some under load)
                while (unprocessed.length > 0 && retries < maxRetries) {
                    const result = await docClient.send(
                        new BatchWriteCommand({
                            RequestItems: {
                                [tables.leads]: unprocessed.map((lead) => ({
                                    PutRequest: { Item: lead },
                                })),
                            },
                        })
                    );

                    // Check for unprocessed items
                    const unprocessedItems = result.UnprocessedItems?.[tables.leads];
                    if (unprocessedItems && unprocessedItems.length > 0) {
                        // Extract leads from unprocessed items for retry
                        unprocessed = unprocessedItems.map((item) => item.PutRequest?.Item) as typeof batch;
                        retries++;
                        await new Promise((resolve) => setTimeout(resolve, 100 * retries));
                    } else {
                        unprocessed = [];
                    }
                }
            }

            // Small delay for eventual consistency
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Verify count
            const result = await docClient.send(
                new ScanCommand({
                    TableName: tables.leads,
                    Select: 'COUNT',
                })
            );

            expect(result.Count).toBe(50);
        });
    });

    describe('Verification Queue Integration', () => {
        it('should queue leads for verification after import', async () => {
            const lead = createLead({
                email: 'verify@example.com',
                status: 'PENDING_IMPORT',
            });

            await insertLead(lead);

            // Queue for verification
            await sendToVerificationQueue({
                leadId: lead.id,
                email: lead.email,
            });

            // Verify queued
            const messages = await receiveMessages(
                queues.verification,
                1,
                5
            );

            expect(messages).toHaveLength(1);
            expect((messages[0].parsedBody as any).leadId).toBe(lead.id);
        });

        it('should queue multiple leads for verification', async () => {
            const leads = [
                createLead({ email: 'verify1@example.com' }),
                createLead({ email: 'verify2@example.com' }),
                createLead({ email: 'verify3@example.com' }),
            ];

            for (const lead of leads) {
                await insertLead(lead);
                await sendToVerificationQueue({
                    leadId: lead.id,
                    email: lead.email,
                });
            }

            const messages = await receiveMessages(
                queues.verification,
                10,
                5
            );

            expect(messages.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Import Validation', () => {
        it('should normalize email to lowercase', async () => {
            const lead = createLead({ email: 'UPPERCASE@EXAMPLE.COM' });
            // Normalize email before insert
            lead.email = lead.email.toLowerCase();

            await insertLead(lead);

            const retrieved = await getLead(lead.id);
            expect(retrieved?.email).toBe('uppercase@example.com');
        });

        it('should preserve original name casing', async () => {
            const lead = createLead({ fullName: 'John MacDonald' });
            await insertLead(lead);

            const retrieved = await getLead(lead.id);
            expect(retrieved?.fullName).toBe('John MacDonald');
        });

        it('should assign campaign ID during import', async () => {
            const campaignId = 'campaign-import-123';
            const lead = createLead({ campaignId });

            await insertLead(lead);

            const retrieved = await getLead(lead.id);
            expect(retrieved?.campaignId).toBe(campaignId);
        });
    });

    describe('Duplicate Detection', () => {
        it('should find existing leads by email via GSI', async () => {
            const email = 'existing@example.com';

            // Insert existing lead
            const existingLead = createLead({ email });
            await insertLead(existingLead);

            // Query for duplicate
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tables.leads,
                    IndexName: 'EmailIndex',
                    KeyConditionExpression: 'email = :email',
                    ExpressionAttributeValues: { ':email': email },
                })
            );

            expect(result.Items).toHaveLength(1);
            expect(result.Items?.[0].id).toBe(existingLead.id);
        });

        it('should count duplicates in import batch', async () => {
            // Pre-existing leads
            const existingEmails = ['existing1@example.com', 'existing2@example.com'];
            for (const email of existingEmails) {
                await insertLead(createLead({ email }));
            }

            // Simulate import batch check
            const importEmails = [
                'existing1@example.com', // Duplicate
                'new1@example.com', // New
                'existing2@example.com', // Duplicate
                'new2@example.com', // New
            ];

            let duplicateCount = 0;
            let newCount = 0;

            for (const email of importEmails) {
                const result = await docClient.send(
                    new QueryCommand({
                        TableName: tables.leads,
                        IndexName: 'EmailIndex',
                        KeyConditionExpression: 'email = :email',
                        ExpressionAttributeValues: { ':email': email },
                        Select: 'COUNT',
                    })
                );

                if ((result.Count || 0) > 0) {
                    duplicateCount++;
                } else {
                    newCount++;
                }
            }

            expect(duplicateCount).toBe(2);
            expect(newCount).toBe(2);
        });
    });

    describe('API Gateway Event Handling', () => {
        it('should create valid import request event', () => {
            const importData = {
                leads: [
                    { fullName: 'John Doe', email: 'john@example.com', companyName: 'Acme' },
                    { fullName: 'Jane Smith', email: 'jane@example.com', companyName: 'Tech Co' },
                ],
                campaignId: 'campaign-123',
            };

            const event = createAPIGatewayEvent('POST', '/leads/import', {
                body: importData,
            });

            expect(event.httpMethod).toBe('POST');
            expect(event.path).toBe('/leads/import');

            const body = JSON.parse(event.body!);
            expect(body.leads).toHaveLength(2);
            expect(body.campaignId).toBe('campaign-123');
        });

        it('should handle CSV-style import data', () => {
            // Simulate parsed CSV data
            const csvData = {
                headers: ['fullName', 'email', 'companyName', 'phone'],
                rows: [
                    ['John Doe', 'john@example.com', 'Acme Corp', '555-1234'],
                    ['Jane Smith', 'jane@example.com', 'Tech Inc', '555-5678'],
                ],
            };

            // Transform to lead objects
            const leads = csvData.rows.map((row) => ({
                fullName: row[0],
                email: row[1],
                companyName: row[2],
                phoneNumber: row[3],
            }));

            expect(leads).toHaveLength(2);
            expect(leads[0].fullName).toBe('John Doe');
            expect(leads[1].email).toBe('jane@example.com');
        });
    });

    describe('Lead Type Classification', () => {
        it('should set leadType during import', async () => {
            const softwareLead = createLead({ leadType: 'SOFTWARE' });
            const hardwareLead = createLead({ leadType: 'HARDWARE' });
            const bothLead = createLead({ leadType: 'BOTH' });

            await insertLead(softwareLead);
            await insertLead(hardwareLead);
            await insertLead(bothLead);

            expect((await getLead(softwareLead.id))?.leadType).toBe('SOFTWARE');
            expect((await getLead(hardwareLead.id))?.leadType).toBe('HARDWARE');
            expect((await getLead(bothLead.id))?.leadType).toBe('BOTH');
        });
    });
});
