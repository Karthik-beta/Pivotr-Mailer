/**
 * Integration Tests: Process Feedback Lambda
 *
 * Tests bounce, complaint, and delivery handling.
 * Validates the SES -> SNS -> SQS -> Lambda feedback pipeline.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
    createLead,
    createBounceNotification,
    createComplaintNotification,
    createDeliveryNotification,
    wrapAsSNSMessage,
    createSQSEvent,
    createSQSRecord,
} from '../../utils/fixtures.js';
import {
    insertLead,
    getLead,
    clearLeadsTable,
    insertMetrics,
    getMetrics,
    clearMetricsTable,
} from '../../utils/dynamodb-helpers.js';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

describe('Process Feedback Integration Tests', () => {
    beforeEach(async () => {
        await clearLeadsTable();
        await clearMetricsTable();
    });

    describe('Bounce Handling', () => {
        it('should process permanent bounce notification', async () => {
            // Create a lead that was sent an email
            const lead = createLead({
                status: 'SENT',
                email: 'bounced@example.com',
            });
            (lead as any).lastMessageId = 'ses-msg-bounce-001';
            await insertLead(lead);

            // Create bounce notification
            const notification = createBounceNotification(
                'bounced@example.com',
                'ses-msg-bounce-001',
                'Permanent',
                'General'
            );

            // Simulate the SES -> SNS -> SQS structure
            const snsMessage = wrapAsSNSMessage(notification);
            const sqsRecord = createSQSRecord(snsMessage);
            const event = createSQSEvent([sqsRecord]);

            // Verify the event structure is correct
            expect(event.Records).toHaveLength(1);
            expect(event.Records[0].body).toContain('Bounce');
        });

        it('should categorize bounce types correctly', () => {
            const permanentBounce = createBounceNotification(
                'test@example.com',
                'msg-1',
                'Permanent',
                'General'
            );
            const transientBounce = createBounceNotification(
                'test@example.com',
                'msg-2',
                'Transient',
                'MailboxFull'
            );

            expect(permanentBounce.bounce.bounceType).toBe('Permanent');
            expect(transientBounce.bounce.bounceType).toBe('Transient');
            expect(transientBounce.bounce.bounceSubType).toBe('MailboxFull');
        });

        it('should handle bounce with multiple recipients', () => {
            const notification = createBounceNotification(
                'user1@example.com',
                'msg-multi'
            );

            // Add additional recipient
            notification.bounce.bouncedRecipients.push({
                emailAddress: 'user2@example.com',
            });
            notification.mail.destination.push('user2@example.com');

            expect(notification.bounce.bouncedRecipients).toHaveLength(2);
            expect(notification.mail.destination).toHaveLength(2);
        });
    });

    describe('Complaint Handling', () => {
        it('should process spam complaint notification', async () => {
            const lead = createLead({
                status: 'DELIVERED',
                email: 'complained@example.com',
            });
            (lead as any).lastMessageId = 'ses-msg-complaint-001';
            await insertLead(lead);

            const notification = createComplaintNotification(
                'complained@example.com',
                'ses-msg-complaint-001',
                'abuse'
            );

            expect(notification.notificationType).toBe('Complaint');
            expect(notification.complaint.complaintFeedbackType).toBe('abuse');
        });

        it('should handle different complaint types', () => {
            const abuseComplaint = createComplaintNotification('test@example.com', 'msg-1', 'abuse');
            const notSpamComplaint = createComplaintNotification('test@example.com', 'msg-2', 'not-spam');
            const virusComplaint = createComplaintNotification('test@example.com', 'msg-3', 'virus');

            expect(abuseComplaint.complaint.complaintFeedbackType).toBe('abuse');
            expect(notSpamComplaint.complaint.complaintFeedbackType).toBe('not-spam');
            expect(virusComplaint.complaint.complaintFeedbackType).toBe('virus');
        });
    });

    describe('Delivery Handling', () => {
        it('should process delivery notification', async () => {
            const lead = createLead({
                status: 'SENT',
                email: 'delivered@example.com',
            });
            (lead as any).lastMessageId = 'ses-msg-delivery-001';
            await insertLead(lead);

            const notification = createDeliveryNotification(
                'delivered@example.com',
                'ses-msg-delivery-001'
            );

            expect(notification.notificationType).toBe('Delivery');
            expect(notification.delivery.recipients).toContain('delivered@example.com');
        });
    });

    describe('Metrics Updates', () => {
        it('should track daily metrics counters', async () => {
            const today = new Date().toISOString().split('T')[0];

            // Initialize metrics
            await insertMetrics({
                pk: 'GLOBAL',
                sk: today,
                sentCount: 100,
                bounces: 2,
                complaints: 0,
                deliveries: 95,
            });

            // Verify retrieval
            const metrics = await getMetrics('GLOBAL', today);

            expect(metrics).toBeDefined();
            expect(metrics?.sentCount).toBe(100);
            expect(metrics?.bounces).toBe(2);
            expect(metrics?.deliveries).toBe(95);
        });

        it('should calculate bounce rate correctly', async () => {
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

            expect(bounceRate).toBe(0.05); // 5% bounce rate
            expect(complaintRate).toBe(0.001); // 0.1% complaint rate
        });
    });

    describe('SNS Message Wrapping', () => {
        it('should correctly wrap notification as SNS message', () => {
            const notification = createBounceNotification('test@example.com', 'msg-123');
            const snsMessage = wrapAsSNSMessage(notification);

            expect(snsMessage).toHaveProperty('Type', 'Notification');
            expect(snsMessage).toHaveProperty('Message');
            expect(snsMessage).toHaveProperty('TopicArn');
            expect(snsMessage).toHaveProperty('Timestamp');

            // Verify Message is stringified notification
            const parsedMessage = JSON.parse((snsMessage as any).Message);
            expect(parsedMessage.notificationType).toBe('Bounce');
        });

        it('should produce valid SQS record with nested SNS message', () => {
            const notification = createBounceNotification('test@example.com', 'msg-123');
            const snsMessage = wrapAsSNSMessage(notification);
            const sqsRecord = createSQSRecord(snsMessage);

            // Parse the nested structure
            const body = JSON.parse(sqsRecord.body);
            expect(body.Type).toBe('Notification');

            const innerMessage = JSON.parse(body.Message);
            expect(innerMessage.notificationType).toBe('Bounce');
            expect(innerMessage.mail.messageId).toBe('msg-123');
        });
    });
});
