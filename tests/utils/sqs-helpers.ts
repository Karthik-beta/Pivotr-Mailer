/**
 * SQS Test Helpers
 *
 * Utilities for managing SQS queues in integration tests.
 */

import {
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    PurgeQueueCommand,
    GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { getSQSClient, getQueueUrls } from './aws-clients.js';

const sqsClient = getSQSClient();
const queues = getQueueUrls();

// =============================================================================
// Message Sending
// =============================================================================

/**
 * Send a message to a queue
 */
export async function sendMessage(queueUrl: string, body: object): Promise<string | undefined> {
    const result = await sqsClient.send(
        new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(body),
        })
    );
    return result.MessageId;
}

/**
 * Send message to sending queue
 */
export async function sendToSendingQueue(message: object): Promise<string | undefined> {
    return sendMessage(queues.sending, message);
}

/**
 * Send message to feedback queue
 */
export async function sendToFeedbackQueue(message: object): Promise<string | undefined> {
    return sendMessage(queues.feedback, message);
}

/**
 * Send message to verification queue
 */
export async function sendToVerificationQueue(message: object): Promise<string | undefined> {
    return sendMessage(queues.verification, message);
}

// =============================================================================
// Message Receiving
// =============================================================================

export interface ReceivedMessage {
    messageId: string;
    receiptHandle: string;
    body: string;
    parsedBody: object;
}

/**
 * Receive messages from a queue
 */
export async function receiveMessages(
    queueUrl: string,
    maxMessages: number = 10,
    waitTimeSeconds: number = 1
): Promise<ReceivedMessage[]> {
    const result = await sqsClient.send(
        new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: waitTimeSeconds,
        })
    );

    return (result.Messages || []).map((msg) => ({
        messageId: msg.MessageId!,
        receiptHandle: msg.ReceiptHandle!,
        body: msg.Body!,
        parsedBody: JSON.parse(msg.Body!),
    }));
}

/**
 * Delete a message from a queue
 */
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    await sqsClient.send(
        new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
        })
    );
}

// =============================================================================
// Queue Management
// =============================================================================

/**
 * Purge all messages from a queue
 */
export async function purgeQueue(queueUrl: string): Promise<void> {
    try {
        await sqsClient.send(
            new PurgeQueueCommand({
                QueueUrl: queueUrl,
            })
        );
    } catch (error: any) {
        // PurgeQueueInProgress is not an error condition for tests
        if (error.name !== 'PurgeQueueInProgress') {
            throw error;
        }
    }
}

/**
 * Get queue message count
 */
export async function getQueueMessageCount(queueUrl: string): Promise<number> {
    const result = await sqsClient.send(
        new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ['ApproximateNumberOfMessages'],
        })
    );

    return parseInt(result.Attributes?.ApproximateNumberOfMessages || '0', 10);
}

/**
 * Get DLQ message count
 */
export async function getDLQMessageCount(dlqUrl: string): Promise<number> {
    return getQueueMessageCount(dlqUrl);
}

/**
 * Purge all test queues
 */
export async function purgeAllQueues(): Promise<void> {
    await Promise.all([
        purgeQueue(queues.sending),
        purgeQueue(queues.feedback),
        purgeQueue(queues.verification),
        purgeQueue(queues.sendingDlq),
        purgeQueue(queues.feedbackDlq),
        purgeQueue(queues.verificationDlq),
    ]);
}

/**
 * Wait for queue to be empty
 */
export async function waitForEmptyQueue(
    queueUrl: string,
    timeoutMs: number = 10000,
    pollIntervalMs: number = 500
): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const count = await getQueueMessageCount(queueUrl);
        if (count === 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Queue ${queueUrl} not empty after ${timeoutMs}ms`);
}

/**
 * Wait for message in DLQ
 */
export async function waitForDLQMessage(
    dlqUrl: string,
    timeoutMs: number = 10000,
    pollIntervalMs: number = 500
): Promise<ReceivedMessage | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const messages = await receiveMessages(dlqUrl, 1, 0);
        if (messages.length > 0) {
            return messages[0];
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return null;
}
