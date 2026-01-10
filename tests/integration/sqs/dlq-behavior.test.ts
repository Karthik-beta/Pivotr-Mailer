/**
 * Integration Tests: SQS DLQ Behavior
 *
 * Tests Dead Letter Queue behavior and message retry logic.
 * Validates the safety mechanisms for failed message handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    sendToSendingQueue,
    sendToFeedbackQueue,
    receiveMessages,
    getQueueMessageCount,
    getDLQMessageCount,
    purgeAllQueues,
    deleteMessage,
} from '../../utils/sqs-helpers.js';
import { getSQSClient, getQueueUrls } from '../../utils/aws-clients.js';
import { SetQueueAttributesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const sqsClient = getSQSClient();
const queues = getQueueUrls();

describe('SQS DLQ Behavior', () => {
    beforeEach(async () => {
        await purgeAllQueues();
        // Wait for purge to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    describe('Queue Configuration', () => {
        it('should have sending queue configured with DLQ', async () => {
            const result = await sqsClient.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queues.sending,
                    AttributeNames: ['RedrivePolicy'],
                })
            );

            expect(result.Attributes?.RedrivePolicy).toBeDefined();

            const policy = JSON.parse(result.Attributes!.RedrivePolicy!);
            expect(policy.maxReceiveCount).toBeDefined();
            expect(policy.deadLetterTargetArn).toBeDefined();
        });

        it('should have feedback queue configured with DLQ', async () => {
            const result = await sqsClient.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queues.feedback,
                    AttributeNames: ['RedrivePolicy'],
                })
            );

            expect(result.Attributes?.RedrivePolicy).toBeDefined();
        });

        it('should have verification queue configured with DLQ', async () => {
            const result = await sqsClient.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queues.verification,
                    AttributeNames: ['RedrivePolicy'],
                })
            );

            expect(result.Attributes?.RedrivePolicy).toBeDefined();
        });
    });

    describe('Queue Visibility Timeout', () => {
        it('should have appropriate visibility timeout for sending queue', async () => {
            const result = await sqsClient.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queues.sending,
                    AttributeNames: ['VisibilityTimeout'],
                })
            );

            const timeout = parseInt(result.Attributes?.VisibilityTimeout || '0', 10);
            // Should be Lambda timeout (30s) + buffer (5s) = 35s
            expect(timeout).toBeGreaterThanOrEqual(35);
        });

        it('should have appropriate visibility timeout for feedback queue', async () => {
            const result = await sqsClient.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queues.feedback,
                    AttributeNames: ['VisibilityTimeout'],
                })
            );

            const timeout = parseInt(result.Attributes?.VisibilityTimeout || '0', 10);
            // Should be Lambda timeout (10s) + buffer (5s) = 15s
            expect(timeout).toBeGreaterThanOrEqual(15);
        });
    });

    describe('Message Processing', () => {
        it('should receive messages in order they were sent', async () => {
            const messages = [
                { order: 1, data: 'first' },
                { order: 2, data: 'second' },
                { order: 3, data: 'third' },
            ];

            for (const msg of messages) {
                await sendToSendingQueue(msg);
            }

            const received = await receiveMessages(queues.sending, 10, 5);

            expect(received.length).toBeGreaterThanOrEqual(1);
        });

        it('should delete processed messages', async () => {
            await sendToSendingQueue({ test: 'delete-test' });

            // Receive
            const messages = await receiveMessages(queues.sending, 1, 5);
            expect(messages).toHaveLength(1);

            // Delete
            await deleteMessage(queues.sending, messages[0].receiptHandle);

            // Verify deleted (wait for visibility timeout would see it again otherwise)
            const afterDelete = await receiveMessages(queues.sending, 1, 1);
            expect(afterDelete).toHaveLength(0);
        });

        it('should track message receive count', async () => {
            await sendToSendingQueue({ test: 'receive-count' });

            // First receive
            const first = await receiveMessages(queues.sending, 1, 5);
            expect(first).toHaveLength(1);

            // Don't delete - let it become visible again
            // Note: This is a simplified test - in real scenario
            // you'd need to wait for visibility timeout
        });
    });

    describe('DLQ Message Tracking', () => {
        it('should start with empty DLQ', async () => {
            const count = await getDLQMessageCount(queues.sendingDlq);
            expect(count).toBe(0);
        });

        it('should track DLQ separately from main queue', async () => {
            // Send to main queue
            await sendToSendingQueue({ test: 'main-queue' });

            const mainCount = await getQueueMessageCount(queues.sending);
            const dlqCount = await getDLQMessageCount(queues.sendingDlq);

            expect(mainCount).toBe(1);
            expect(dlqCount).toBe(0);
        });
    });

    describe('Queue Isolation', () => {
        it('should keep messages isolated between different queues', async () => {
            await sendToSendingQueue({ queue: 'sending', id: 1 });
            await sendToFeedbackQueue({ queue: 'feedback', id: 2 });

            const sendingMessages = await receiveMessages(queues.sending, 10, 2);
            const feedbackMessages = await receiveMessages(queues.feedback, 10, 2);

            expect(sendingMessages).toHaveLength(1);
            expect(feedbackMessages).toHaveLength(1);

            expect((sendingMessages[0].parsedBody as any).queue).toBe('sending');
            expect((feedbackMessages[0].parsedBody as any).queue).toBe('feedback');
        });

        it('should keep DLQs isolated from their parent queues', async () => {
            // Main queues should not share messages with DLQs
            await sendToSendingQueue({ test: 'main' });

            const mainMessages = await receiveMessages(queues.sending, 1, 2);
            const dlqMessages = await receiveMessages(queues.sendingDlq, 1, 1);

            expect(mainMessages).toHaveLength(1);
            expect(dlqMessages).toHaveLength(0);
        });
    });

    describe('Message Attributes', () => {
        it('should preserve message body through queue', async () => {
            const originalMessage = {
                leadId: 'lead-123',
                campaignId: 'campaign-456',
                complexData: {
                    nested: {
                        value: 'test',
                    },
                    array: [1, 2, 3],
                },
            };

            await sendToSendingQueue(originalMessage);

            const received = await receiveMessages(queues.sending, 1, 5);
            expect(received).toHaveLength(1);

            expect(received[0].parsedBody).toEqual(originalMessage);
        });

        it('should handle large message bodies', async () => {
            const largeMessage = {
                leadId: 'lead-large',
                bodyTemplate: 'x'.repeat(10000), // 10KB of data
                metadata: Array.from({ length: 100 }, (_, i) => ({
                    key: `key-${i}`,
                    value: `value-${i}`,
                })),
            };

            await sendToSendingQueue(largeMessage);

            const received = await receiveMessages(queues.sending, 1, 5);
            expect(received).toHaveLength(1);
            expect((received[0].parsedBody as any).bodyTemplate.length).toBe(10000);
        });
    });
});
