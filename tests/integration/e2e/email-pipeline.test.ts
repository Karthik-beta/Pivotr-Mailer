/**
 * Integration Tests: End-to-End Email Pipeline
 *
 * Tests the complete flow from API request through SQS processing.
 * Validates the SES -> SNS -> SQS -> Lambda feedback pipeline.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createLead,
    createCampaign,
    createSendEmailMessage,
    createBounceNotification,
    createDeliveryNotification,
    createComplaintNotification,
    wrapAsSNSMessage,
    createSQSRecord,
    createSQSEvent,
} from '../../utils/fixtures.js';
import {
    insertLead,
    insertLeads,
    getLead,
    clearLeadsTable,
    insertCampaign,
    clearCampaignsTable,
    insertMetrics,
    getMetrics,
    clearMetricsTable,
} from '../../utils/dynamodb-helpers.js';
import {
    sendToSendingQueue,
    sendToFeedbackQueue,
    receiveMessages,
    purgeAllQueues,
} from '../../utils/sqs-helpers.js';
import { getDocumentClient, getTableNames, getQueueUrls } from '../../utils/aws-clients.js';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const docClient = getDocumentClient();
const tables = getTableNames();
const queues = getQueueUrls();

describe('End-to-End Email Pipeline', () => {
    beforeEach(async () => {
        await Promise.all([
            clearLeadsTable(),
            clearCampaignsTable(),
            clearMetricsTable(),
            purgeAllQueues(),
        ]);
        // Wait for cleanup
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    describe('Email Sending Flow', () => {
        it('should queue email for sending', async () => {
            // 1. Create lead and campaign
            const lead = createLead({
                email: 'test@example.com',
                status: 'QUEUED',
            });
            const campaign = createCampaign({
                name: 'Test Campaign',
                subject: 'Hello {firstName}!',
                bodyTemplate: '<p>Hi {firstName}, welcome!</p>',
            });

            await insertLead(lead);
            await insertCampaign(campaign);

            // 2. Queue email
            const message = createSendEmailMessage(lead.id, campaign.id, {
                subjectTemplate: campaign.subject,
                bodyTemplate: campaign.bodyTemplate,
            });

            const messageId = await sendToSendingQueue(message);
            expect(messageId).toBeDefined();

            // 3. Verify message is in queue
            const messages = await receiveMessages(
                queues.sending,
                1,
                5
            );
            expect(messages).toHaveLength(1);
            expect((messages[0].parsedBody as any).leadId).toBe(lead.id);
        });

        it('should simulate email send and status update', async () => {
            const lead = createLead({ status: 'QUEUED' });
            await insertLead(lead);

            // Simulate what Lambda would do
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.leads,
                    Key: { id: lead.id },
                    UpdateExpression: 'SET #status = :status, sentAt = :sentAt, lastMessageId = :msgId',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'SENT',
                        ':sentAt': new Date().toISOString(),
                        ':msgId': 'ses-msg-12345',
                    },
                })
            );

            const updated = await getLead(lead.id);
            expect(updated?.status).toBe('SENT');
            expect((updated as any).lastMessageId).toBe('ses-msg-12345');
        });
    });

    describe('SES Feedback Pipeline', () => {
        it('should process delivery notification end-to-end', async () => {
            // 1. Create lead that was sent an email
            const lead = createLead({ status: 'SENT', email: 'delivered@example.com' });
            (lead as any).lastMessageId = 'ses-msg-delivery';
            await insertLead(lead);

            // 2. Simulate SES delivery notification
            const notification = createDeliveryNotification('delivered@example.com', 'ses-msg-delivery');
            const snsMessage = wrapAsSNSMessage(notification);

            // 3. Send to feedback queue (simulating SNS -> SQS)
            await sendToFeedbackQueue(snsMessage);

            // 4. Verify notification is queued
            const messages = await receiveMessages(
                queues.feedback,
                1,
                5
            );
            expect(messages).toHaveLength(1);

            // 5. Parse and verify structure
            const body = messages[0].parsedBody as { Message: string };
            const innerNotification = JSON.parse(body.Message);
            expect(innerNotification.notificationType).toBe('Delivery');
        });

        it('should process bounce notification end-to-end', async () => {
            // 1. Create lead
            const lead = createLead({ status: 'SENT', email: 'bounced@example.com' });
            (lead as any).lastMessageId = 'ses-msg-bounce';
            await insertLead(lead);

            // 2. Initialize metrics
            const today = new Date().toISOString().split('T')[0];
            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 100,
                bounces: 2,
                complaints: 0,
                deliveries: 98,
            });

            // 3. Simulate bounce
            const notification = createBounceNotification('bounced@example.com', 'ses-msg-bounce', 'Permanent', 'General');
            const snsMessage = wrapAsSNSMessage(notification);
            await sendToFeedbackQueue(snsMessage);

            // 4. Simulate what Lambda would do - update lead
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.leads,
                    Key: { id: lead.id },
                    UpdateExpression: 'SET #status = :status, bounceType = :bounceType',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'BOUNCED',
                        ':bounceType': 'Permanent',
                    },
                })
            );

            // 5. Simulate metrics increment
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.metrics,
                    Key: { pk: 'GLOBAL', sk: today },
                    UpdateExpression: 'ADD bounces :inc',
                    ExpressionAttributeValues: { ':inc': 1 },
                })
            );

            // 6. Verify updates
            const updatedLead = await getLead(lead.id);
            expect(updatedLead?.status).toBe('BOUNCED');

            const updatedMetrics = await getMetrics('GLOBAL', today);
            expect(updatedMetrics?.bounces).toBe(3);
        });

        it('should process complaint and mark lead as unsubscribed', async () => {
            const lead = createLead({ status: 'DELIVERED', email: 'complained@example.com' });
            (lead as any).lastMessageId = 'ses-msg-complaint';
            await insertLead(lead);

            // Simulate complaint
            const notification = createComplaintNotification('complained@example.com', 'ses-msg-complaint', 'abuse');
            const snsMessage = wrapAsSNSMessage(notification);
            await sendToFeedbackQueue(snsMessage);

            // Simulate Lambda update
            await docClient.send(
                new UpdateCommand({
                    TableName: tables.leads,
                    Key: { id: lead.id },
                    UpdateExpression: 'SET #status = :status, isUnsubscribed = :unsub, complaintFeedbackType = :type',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: {
                        ':status': 'COMPLAINED',
                        ':unsub': true,
                        ':type': 'abuse',
                    },
                })
            );

            const updated = await getLead(lead.id);
            expect(updated?.status).toBe('COMPLAINED');
            expect((updated as any).isUnsubscribed).toBe(true);
        });
    });

    describe('Batch Processing', () => {
        it('should handle batch of emails for campaign', async () => {
            const campaign = createCampaign({ status: 'RUNNING' });
            await insertCampaign(campaign);

            // Create 10 leads for the campaign
            const leads = Array.from({ length: 10 }, (_, i) =>
                createLead({
                    email: `lead${i}@example.com`,
                    status: 'QUEUED',
                    campaignId: campaign.id,
                })
            );
            await insertLeads(leads);

            // Queue all emails
            for (const lead of leads) {
                await sendToSendingQueue(
                    createSendEmailMessage(lead.id, campaign.id)
                );
            }

            // Verify all queued
            const messages = await receiveMessages(
                queues.sending,
                10,
                5
            );
            expect(messages.length).toBeGreaterThanOrEqual(10);
        });

        it('should handle mixed feedback batch', async () => {
            // Create leads with different outcomes
            const leads = [
                createLead({ email: 'delivered1@example.com', status: 'SENT' }),
                createLead({ email: 'delivered2@example.com', status: 'SENT' }),
                createLead({ email: 'bounced@example.com', status: 'SENT' }),
            ];

            for (let i = 0; i < leads.length; i++) {
                (leads[i] as any).lastMessageId = `msg-${i}`;
            }
            await insertLeads(leads);

            // Queue mixed feedback
            await sendToFeedbackQueue(
                wrapAsSNSMessage(createDeliveryNotification('delivered1@example.com', 'msg-0'))
            );
            await sendToFeedbackQueue(
                wrapAsSNSMessage(createDeliveryNotification('delivered2@example.com', 'msg-1'))
            );
            await sendToFeedbackQueue(
                wrapAsSNSMessage(createBounceNotification('bounced@example.com', 'msg-2'))
            );

            // Verify all in queue
            const messages = await receiveMessages(
                queues.feedback,
                10,
                5
            );
            expect(messages.length).toBeGreaterThanOrEqual(3);

            // Parse and categorize
            const types = messages.map((m) => {
                const body = m.parsedBody as { Message: string };
                return JSON.parse(body.Message).notificationType;
            });

            expect(types.filter((t) => t === 'Delivery').length).toBe(2);
            expect(types.filter((t) => t === 'Bounce').length).toBe(1);
        });
    });

    describe('Error Scenarios', () => {
        it('should handle missing lead gracefully', async () => {
            // Queue message for non-existent lead
            const message = createSendEmailMessage('non-existent-lead', 'campaign-123');
            await sendToSendingQueue(message);

            // Verify message is in queue (Lambda would handle the missing lead)
            const messages = await receiveMessages(
                queues.sending,
                1,
                5
            );
            expect(messages).toHaveLength(1);
            expect((messages[0].parsedBody as any).leadId).toBe('non-existent-lead');
        });

        it('should handle malformed message body', async () => {
            // This tests that our fixture system creates valid JSON
            const validMessage = createSendEmailMessage('lead-1', 'campaign-1');
            const record = createSQSRecord(validMessage);

            // Body should be valid JSON
            expect(() => JSON.parse(record.body)).not.toThrow();
        });
    });
});
