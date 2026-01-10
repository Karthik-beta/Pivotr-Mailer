/**
 * Integration Tests: SQS Message Flow
 *
 * Tests message publishing and consumption via LocalStack SQS.
 * Validates the event-driven workflow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    sendToSendingQueue,
    sendToFeedbackQueue,
    receiveMessages,
    getQueueMessageCount,
    purgeAllQueues,
} from '../../utils/sqs-helpers.js';
import {
    createSendEmailMessage,
    createBounceNotification,
    createDeliveryNotification,
    wrapAsSNSMessage,
} from '../../utils/fixtures.js';
import { getQueueUrls } from '../../utils/aws-clients.js';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const queues = getQueueUrls();

describe('SQS Integration Tests', () => {
    beforeEach(async () => {
        await purgeAllQueues();
    });

    describe('Sending Queue', () => {
        it('should send and receive a message', async () => {
            const message = createSendEmailMessage('lead-123', 'campaign-456');

            // Send message
            const messageId = await sendToSendingQueue(message);
            expect(messageId).toBeDefined();

            // Receive message
            const messages = await receiveMessages(
                queues.sending,
                1,
                5
            );

            expect(messages).toHaveLength(1);
            expect(messages[0].parsedBody).toEqual(message);
        });

        it('should handle multiple messages', async () => {
            const messages = [
                createSendEmailMessage('lead-1', 'campaign-1'),
                createSendEmailMessage('lead-2', 'campaign-1'),
                createSendEmailMessage('lead-3', 'campaign-1'),
            ];

            // Send all messages
            for (const msg of messages) {
                await sendToSendingQueue(msg);
            }

            // Check queue count
            const count = await getQueueMessageCount(queues.sending);
            expect(count).toBe(3);
        });
    });

    describe('Feedback Queue', () => {
        it('should receive bounce notification', async () => {
            const notification = createBounceNotification(
                'test@example.com',
                'msg-123',
                'Permanent',
                'General'
            );

            // Wrap as SNS message (simulating SES -> SNS -> SQS flow)
            const snsMessage = wrapAsSNSMessage(notification);

            // Send to feedback queue
            await sendToFeedbackQueue(snsMessage);

            // Receive and parse
            const messages = await receiveMessages(
                queues.feedback,
                1,
                5
            );

            expect(messages).toHaveLength(1);

            // Parse nested structure
            const snsBody = messages[0].parsedBody as { Message: string };
            const parsedNotification = JSON.parse(snsBody.Message);

            expect(parsedNotification.notificationType).toBe('Bounce');
            expect(parsedNotification.bounce.bounceType).toBe('Permanent');
        });

        it('should receive delivery notification', async () => {
            const notification = createDeliveryNotification('test@example.com', 'msg-456');
            const snsMessage = wrapAsSNSMessage(notification);

            await sendToFeedbackQueue(snsMessage);

            const messages = await receiveMessages(
                queues.feedback,
                1,
                5
            );

            const snsBody = messages[0].parsedBody as { Message: string };
            const parsedNotification = JSON.parse(snsBody.Message);

            expect(parsedNotification.notificationType).toBe('Delivery');
            expect(parsedNotification.delivery.recipients).toContain('test@example.com');
        });
    });

    describe('Queue Isolation', () => {
        it('should maintain message isolation between queues', async () => {
            // Send different messages to different queues
            await sendToSendingQueue({ type: 'send', id: 1 });
            await sendToFeedbackQueue({ type: 'feedback', id: 2 });

            // Verify each queue has correct message
            const sendingMessages = await receiveMessages(
                queues.sending,
                10,
                2
            );
            const feedbackMessages = await receiveMessages(
                queues.feedback,
                10,
                2
            );

            expect(sendingMessages).toHaveLength(1);
            expect(feedbackMessages).toHaveLength(1);

            expect((sendingMessages[0].parsedBody as any).type).toBe('send');
            expect((feedbackMessages[0].parsedBody as any).type).toBe('feedback');
        });
    });

    describe('Queue Purging', () => {
        it('should purge all queues', async () => {
            // Add messages to all queues
            await sendToSendingQueue({ test: 1 });
            await sendToFeedbackQueue({ test: 2 });

            // Verify messages exist
            expect(await getQueueMessageCount(queues.sending)).toBeGreaterThan(0);

            // Purge
            await purgeAllQueues();

            // Give LocalStack time to process purge
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify empty (approximate - purge is async)
            const count = await getQueueMessageCount(queues.sending);
            expect(count).toBe(0);
        });
    });
});
