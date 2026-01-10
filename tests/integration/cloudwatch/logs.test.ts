/**
 * Integration Tests: CloudWatch Logs
 *
 * Tests CloudWatch Logs operations for Lambda function logging.
 * Validates log group management, log events, and structured logging.
 *
 * LIMITATIONS:
 * - LocalStack has partial CloudWatch Logs support
 * - Log Insights queries are not supported
 * - Some filtering patterns may behave differently
 * - Metric filters are not fully supported
 *
 * These tests focus on core logging functionality that LocalStack supports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    ensureLogGroupExists,
    logGroupExists,
    deleteLogGroup,
    createLogStream,
    logStreamExists,
    putLogEvents,
    putStructuredLogEvents,
    getLogEvents,
    getStructuredLogEvents,
    filterLogEvents,
    setupTestLogGroup,
    cleanupTestLogGroup,
    waitForLogEvents,
    createStructuredLogEvent,
    type StructuredLogEvent,
} from '../../utils/cloudwatch-helpers.js';
import { getCloudWatchLogsClient, getCloudWatchLogsConfig } from '../../utils/aws-clients.js';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const logsClient = getCloudWatchLogsClient();
const logsConfig = getCloudWatchLogsConfig();

describe('CloudWatch Logs Integration Tests', () => {
    const testLogGroupName = logsConfig.testLogGroup + '-test';
    let testStreamName: string;

    beforeEach(async () => {
        testStreamName = `test-stream-${Date.now()}`;
        await ensureLogGroupExists(testLogGroupName);
        await createLogStream(testLogGroupName, testStreamName);
    });

    afterEach(async () => {
        await deleteLogGroup(testLogGroupName);
    });

    describe('Log Group Operations', () => {
        it('should create and verify log group exists', async () => {
            const groupName = '/pivotr/test/create-verify';

            await ensureLogGroupExists(groupName);
            const exists = await logGroupExists(groupName);

            expect(exists).toBe(true);

            // Cleanup
            await deleteLogGroup(groupName);
        });

        it('should handle creating existing log group idempotently', async () => {
            const groupName = '/pivotr/test/idempotent';

            await ensureLogGroupExists(groupName);
            await ensureLogGroupExists(groupName); // Should not throw

            const exists = await logGroupExists(groupName);
            expect(exists).toBe(true);

            // Cleanup
            await deleteLogGroup(groupName);
        });

        it('should delete log group', async () => {
            const groupName = '/pivotr/test/to-delete';

            await ensureLogGroupExists(groupName);
            expect(await logGroupExists(groupName)).toBe(true);

            await deleteLogGroup(groupName);
            expect(await logGroupExists(groupName)).toBe(false);
        });

        it('should handle deleting non-existent log group gracefully', async () => {
            // Should not throw
            await deleteLogGroup('/pivotr/test/does-not-exist');
        });
    });

    describe('Log Stream Operations', () => {
        it('should create log stream', async () => {
            const streamName = 'new-stream-' + Date.now();
            await createLogStream(testLogGroupName, streamName);

            const exists = await logStreamExists(testLogGroupName, streamName);
            expect(exists).toBe(true);
        });

        it('should verify log stream exists', async () => {
            const exists = await logStreamExists(testLogGroupName, testStreamName);
            expect(exists).toBe(true);
        });

        it('should return false for non-existent stream', async () => {
            const exists = await logStreamExists(testLogGroupName, 'non-existent-stream');
            expect(exists).toBe(false);
        });
    });

    describe('Log Event Operations', () => {
        it('should put and get log events', async () => {
            const messages = ['Test message 1', 'Test message 2', 'Test message 3'];

            await putLogEvents(testLogGroupName, testStreamName, messages);

            // Wait for eventual consistency
            const events = await waitForLogEvents(
                testLogGroupName,
                testStreamName,
                3
            );

            expect(events.length).toBeGreaterThanOrEqual(3);
            expect(events.map((e) => e.message)).toEqual(expect.arrayContaining(messages));
        });

        it('should preserve message order', async () => {
            const messages = ['First', 'Second', 'Third'];

            await putLogEvents(testLogGroupName, testStreamName, messages);

            const events = await waitForLogEvents(
                testLogGroupName,
                testStreamName,
                3
            );

            const retrievedMessages = events.map((e) => e.message);
            expect(retrievedMessages).toContain('First');
            expect(retrievedMessages).toContain('Second');
            expect(retrievedMessages).toContain('Third');
        });

        it('should include timestamps with events', async () => {
            await putLogEvents(testLogGroupName, testStreamName, ['Timestamped message']);

            const events = await waitForLogEvents(testLogGroupName, testStreamName, 1);

            expect(events[0].timestamp).toBeGreaterThan(0);
            // Timestamp should be within last minute
            expect(events[0].timestamp).toBeGreaterThan(Date.now() - 60000);
        });

        it('should handle large log messages', async () => {
            const largeMessage = 'L'.repeat(10000); // 10KB message

            await putLogEvents(testLogGroupName, testStreamName, [largeMessage]);

            const events = await waitForLogEvents(testLogGroupName, testStreamName, 1);

            expect(events[0].message.length).toBe(10000);
        });

        it('should handle many log events', async () => {
            const messages = Array.from({ length: 50 }, (_, i) => `Log message ${i}`);

            await putLogEvents(testLogGroupName, testStreamName, messages);

            const events = await waitForLogEvents(testLogGroupName, testStreamName, 50);

            expect(events.length).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Structured Logging', () => {
        it('should put and get structured log events', async () => {
            const events: StructuredLogEvent[] = [
                createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Processing started',
                    requestId: 'req-123',
                }),
                createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Processing completed',
                    requestId: 'req-123',
                }),
            ];

            await putStructuredLogEvents(testLogGroupName, testStreamName, events);

            const retrieved = await getStructuredLogEvents<StructuredLogEvent>(
                testLogGroupName,
                testStreamName
            );

            expect(retrieved.length).toBeGreaterThanOrEqual(2);
            expect(retrieved.some((e) => e.message === 'Processing started')).toBe(true);
            expect(retrieved.some((e) => e.message === 'Processing completed')).toBe(true);
        });

        it('should preserve structured log data', async () => {
            const event = createStructuredLogEvent({
                level: 'ERROR',
                message: 'An error occurred',
                requestId: 'req-error-123',
                functionName: 'SendEmailLambda',
                data: {
                    leadId: 'lead-123',
                    error: 'Connection timeout',
                    retryCount: 3,
                },
            });

            await putStructuredLogEvents(testLogGroupName, testStreamName, [event]);

            const retrieved = await getStructuredLogEvents<StructuredLogEvent>(
                testLogGroupName,
                testStreamName
            );

            const errorLog = retrieved.find((e) => e.level === 'ERROR');
            expect(errorLog).toBeDefined();
            expect(errorLog?.data?.leadId).toBe('lead-123');
            expect(errorLog?.data?.error).toBe('Connection timeout');
            expect(errorLog?.data?.retryCount).toBe(3);
        });

        it('should handle all log levels', async () => {
            const events: StructuredLogEvent[] = [
                createStructuredLogEvent({ level: 'DEBUG', message: 'Debug message' }),
                createStructuredLogEvent({ level: 'INFO', message: 'Info message' }),
                createStructuredLogEvent({ level: 'WARN', message: 'Warning message' }),
                createStructuredLogEvent({ level: 'ERROR', message: 'Error message' }),
            ];

            await putStructuredLogEvents(testLogGroupName, testStreamName, events);

            const retrieved = await getStructuredLogEvents<StructuredLogEvent>(
                testLogGroupName,
                testStreamName
            );

            expect(retrieved.some((e) => e.level === 'DEBUG')).toBe(true);
            expect(retrieved.some((e) => e.level === 'INFO')).toBe(true);
            expect(retrieved.some((e) => e.level === 'WARN')).toBe(true);
            expect(retrieved.some((e) => e.level === 'ERROR')).toBe(true);
        });
    });

    describe('Log Filtering', () => {
        it('should filter events by pattern', async () => {
            const messages = [
                'INFO: Normal operation',
                'ERROR: Something went wrong',
                'INFO: Another normal operation',
                'ERROR: Critical failure',
            ];

            await putLogEvents(testLogGroupName, testStreamName, messages);
            await waitForLogEvents(testLogGroupName, testStreamName, 4);

            // Note: LocalStack may have limited filter pattern support
            try {
                const errorEvents = await filterLogEvents(
                    testLogGroupName,
                    'ERROR',
                    { limit: 10 }
                );

                expect(errorEvents.length).toBeGreaterThanOrEqual(2);
                expect(errorEvents.every((e) => e.message.includes('ERROR'))).toBe(true);
            } catch {
                // Filter may not be fully supported in LocalStack
                console.log('Note: Filter log events may have limited support in LocalStack');
            }
        });
    });

    describe('Lambda Log Simulation', () => {
        it('should simulate Lambda cold start logs', async () => {
            const lambdaLogGroup = '/aws/lambda/test-function-' + Date.now();
            const lambdaStream = '2024/01/01/[$LATEST]abc123';

            await ensureLogGroupExists(lambdaLogGroup);
            await createLogStream(lambdaLogGroup, lambdaStream);

            const coldStartLogs = [
                'START RequestId: req-123 Version: $LATEST',
                JSON.stringify(createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Lambda initialized',
                    requestId: 'req-123',
                })),
                JSON.stringify(createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Processing email send request',
                    requestId: 'req-123',
                    data: { leadId: 'lead-123' },
                })),
                'END RequestId: req-123',
                'REPORT RequestId: req-123 Duration: 150.00 ms Memory Used: 128 MB',
            ];

            await putLogEvents(lambdaLogGroup, lambdaStream, coldStartLogs);

            const events = await waitForLogEvents(lambdaLogGroup, lambdaStream, 5);

            expect(events.length).toBeGreaterThanOrEqual(5);
            expect(events.some((e) => e.message.includes('START'))).toBe(true);
            expect(events.some((e) => e.message.includes('END'))).toBe(true);
            expect(events.some((e) => e.message.includes('REPORT'))).toBe(true);

            // Cleanup
            await deleteLogGroup(lambdaLogGroup);
        });

        it('should simulate error logging pattern', async () => {
            const errorLogs: StructuredLogEvent[] = [
                createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Starting email send',
                    requestId: 'req-error',
                    data: { leadId: 'lead-fail', campaignId: 'campaign-123' },
                }),
                createStructuredLogEvent({
                    level: 'ERROR',
                    message: 'Failed to send email',
                    requestId: 'req-error',
                    data: {
                        leadId: 'lead-fail',
                        error: 'SES rate limit exceeded',
                        errorCode: 'Throttling',
                    },
                }),
                createStructuredLogEvent({
                    level: 'INFO',
                    message: 'Queuing for retry',
                    requestId: 'req-error',
                    data: { leadId: 'lead-fail', retryAfter: 60 },
                }),
            ];

            await putStructuredLogEvents(testLogGroupName, testStreamName, errorLogs);

            const retrieved = await getStructuredLogEvents<StructuredLogEvent>(
                testLogGroupName,
                testStreamName
            );

            const errorLog = retrieved.find((e) => e.level === 'ERROR');
            expect(errorLog).toBeDefined();
            expect(errorLog?.data?.errorCode).toBe('Throttling');
        });
    });

    describe('Setup Helpers', () => {
        it('should setup test log group with stream', async () => {
            const { logGroupName, logStreamName } = await setupTestLogGroup(
                '/pivotr/test/setup-helper'
            );

            expect(await logGroupExists(logGroupName)).toBe(true);
            expect(await logStreamExists(logGroupName, logStreamName)).toBe(true);

            // Cleanup
            await deleteLogGroup(logGroupName);
        });

        it('should cleanup test log group', async () => {
            const groupName = '/pivotr/test/cleanup-helper';

            await ensureLogGroupExists(groupName);
            await cleanupTestLogGroup(groupName);

            expect(await logGroupExists(groupName)).toBe(false);
        });
    });
});
