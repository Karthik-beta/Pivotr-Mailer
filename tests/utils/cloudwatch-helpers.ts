/**
 * CloudWatch Test Helpers
 *
 * Utility functions for CloudWatch Logs and Metrics in integration tests.
 * Provides helpers for log group management, log event handling, and metrics.
 *
 * LIMITATIONS:
 * - LocalStack has partial CloudWatch Logs support (basic operations work)
 * - CloudWatch Metrics support in LocalStack is limited
 * - Metric alarms are not fully supported in LocalStack
 * - Log Insights queries are not supported in LocalStack
 *
 * These tests focus on what LocalStack can reliably emulate.
 */

import {
    CreateLogGroupCommand,
    CreateLogStreamCommand,
    PutLogEventsCommand,
    GetLogEventsCommand,
    DeleteLogGroupCommand,
    DescribeLogGroupsCommand,
    DescribeLogStreamsCommand,
    FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
    PutMetricDataCommand,
    GetMetricStatisticsCommand,
    ListMetricsCommand,
} from '@aws-sdk/client-cloudwatch';
import { getCloudWatchLogsClient, getCloudWatchClient, getCloudWatchLogsConfig } from './aws-clients.js';

const logsClient = getCloudWatchLogsClient();
const metricsClient = getCloudWatchClient();
const logsConfig = getCloudWatchLogsConfig();

/**
 * Structured log event matching Lambda format
 */
export interface StructuredLogEvent {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: string;
    requestId?: string;
    functionName?: string;
    data?: Record<string, unknown>;
}

/**
 * Metric data point structure
 */
export interface MetricDataPoint {
    metricName: string;
    value: number;
    unit?: string;
    dimensions?: Record<string, string>;
    timestamp?: Date;
}

// ============================================================================
// Log Group Operations
// ============================================================================

/**
 * Check if a log group exists
 */
export async function logGroupExists(logGroupName: string): Promise<boolean> {
    try {
        const response = await logsClient.send(
            new DescribeLogGroupsCommand({
                logGroupNamePrefix: logGroupName,
            })
        );

        return (response.logGroups || []).some(
            (group) => group.logGroupName === logGroupName
        );
    } catch {
        return false;
    }
}

/**
 * Create a log group if it doesn't exist
 */
export async function ensureLogGroupExists(logGroupName: string): Promise<void> {
    if (await logGroupExists(logGroupName)) {
        return;
    }

    await logsClient.send(
        new CreateLogGroupCommand({
            logGroupName,
        })
    );
}

/**
 * Delete a log group
 */
export async function deleteLogGroup(logGroupName: string): Promise<void> {
    try {
        await logsClient.send(
            new DeleteLogGroupCommand({
                logGroupName,
            })
        );
    } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name !== 'ResourceNotFoundException') {
            throw error;
        }
    }
}

/**
 * Create a log stream in a log group
 */
export async function createLogStream(
    logGroupName: string,
    logStreamName: string
): Promise<void> {
    await logsClient.send(
        new CreateLogStreamCommand({
            logGroupName,
            logStreamName,
        })
    );
}

/**
 * Check if a log stream exists
 */
export async function logStreamExists(
    logGroupName: string,
    logStreamName: string
): Promise<boolean> {
    try {
        const response = await logsClient.send(
            new DescribeLogStreamsCommand({
                logGroupName,
                logStreamNamePrefix: logStreamName,
            })
        );

        return (response.logStreams || []).some(
            (stream) => stream.logStreamName === logStreamName
        );
    } catch {
        return false;
    }
}

// ============================================================================
// Log Event Operations
// ============================================================================

/**
 * Put log events to a stream
 */
export async function putLogEvents(
    logGroupName: string,
    logStreamName: string,
    messages: string[],
    sequenceToken?: string
): Promise<string | undefined> {
    const timestamp = Date.now();

    const response = await logsClient.send(
        new PutLogEventsCommand({
            logGroupName,
            logStreamName,
            logEvents: messages.map((message, i) => ({
                message,
                timestamp: timestamp + i, // Ensure unique timestamps
            })),
            sequenceToken,
        })
    );

    return response.nextSequenceToken;
}

/**
 * Put structured log events (JSON format)
 */
export async function putStructuredLogEvents(
    logGroupName: string,
    logStreamName: string,
    events: StructuredLogEvent[],
    sequenceToken?: string
): Promise<string | undefined> {
    const messages = events.map((event) => JSON.stringify(event));
    return putLogEvents(logGroupName, logStreamName, messages, sequenceToken);
}

/**
 * Get log events from a stream
 */
export async function getLogEvents(
    logGroupName: string,
    logStreamName: string,
    options: {
        limit?: number;
        startFromHead?: boolean;
    } = {}
): Promise<Array<{ timestamp: number; message: string }>> {
    const response = await logsClient.send(
        new GetLogEventsCommand({
            logGroupName,
            logStreamName,
            limit: options.limit || 100,
            startFromHead: options.startFromHead ?? true,
        })
    );

    return (response.events || []).map((event) => ({
        timestamp: event.timestamp || 0,
        message: event.message || '',
    }));
}

/**
 * Get log events as parsed JSON
 */
export async function getStructuredLogEvents<T = StructuredLogEvent>(
    logGroupName: string,
    logStreamName: string,
    options: { limit?: number } = {}
): Promise<T[]> {
    const events = await getLogEvents(logGroupName, logStreamName, options);

    return events
        .map((event) => {
            try {
                return JSON.parse(event.message) as T;
            } catch {
                return null;
            }
        })
        .filter((event): event is T => event !== null);
}

/**
 * Filter log events across streams
 */
export async function filterLogEvents(
    logGroupName: string,
    filterPattern: string,
    options: {
        startTime?: number;
        endTime?: number;
        limit?: number;
    } = {}
): Promise<Array<{ timestamp: number; message: string; logStreamName: string }>> {
    const response = await logsClient.send(
        new FilterLogEventsCommand({
            logGroupName,
            filterPattern,
            startTime: options.startTime,
            endTime: options.endTime,
            limit: options.limit || 100,
        })
    );

    return (response.events || []).map((event) => ({
        timestamp: event.timestamp || 0,
        message: event.message || '',
        logStreamName: event.logStreamName || '',
    }));
}

// ============================================================================
// CloudWatch Metrics Operations
// ============================================================================

/**
 * Put a single metric data point
 * Note: LocalStack has limited metrics support
 */
export async function putMetric(
    metricName: string,
    value: number,
    options: {
        namespace?: string;
        unit?: string;
        dimensions?: Record<string, string>;
    } = {}
): Promise<void> {
    const dimensions = options.dimensions
        ? Object.entries(options.dimensions).map(([name, value]) => ({
              Name: name,
              Value: value,
          }))
        : undefined;

    await metricsClient.send(
        new PutMetricDataCommand({
            Namespace: options.namespace || logsConfig.testLogGroup.replace('/', ''),
            MetricData: [
                {
                    MetricName: metricName,
                    Value: value,
                    Unit: options.unit || 'Count',
                    Dimensions: dimensions,
                    Timestamp: new Date(),
                },
            ],
        })
    );
}

/**
 * Put multiple metric data points
 */
export async function putMetrics(
    dataPoints: MetricDataPoint[],
    namespace?: string
): Promise<void> {
    await metricsClient.send(
        new PutMetricDataCommand({
            Namespace: namespace || 'PivotrMailer',
            MetricData: dataPoints.map((dp) => ({
                MetricName: dp.metricName,
                Value: dp.value,
                Unit: dp.unit || 'Count',
                Dimensions: dp.dimensions
                    ? Object.entries(dp.dimensions).map(([name, value]) => ({
                          Name: name,
                          Value: value,
                      }))
                    : undefined,
                Timestamp: dp.timestamp || new Date(),
            })),
        })
    );
}

/**
 * Get metric statistics
 * Note: LocalStack has limited support for this
 */
export async function getMetricStatistics(
    metricName: string,
    options: {
        namespace?: string;
        startTime?: Date;
        endTime?: Date;
        period?: number;
        statistics?: string[];
    } = {}
): Promise<Array<{ timestamp: Date; value: number }>> {
    const endTime = options.endTime || new Date();
    const startTime = options.startTime || new Date(endTime.getTime() - 3600000); // 1 hour ago

    const response = await metricsClient.send(
        new GetMetricStatisticsCommand({
            Namespace: options.namespace || 'PivotrMailer',
            MetricName: metricName,
            StartTime: startTime,
            EndTime: endTime,
            Period: options.period || 60,
            Statistics: options.statistics || ['Sum', 'Average', 'Maximum'],
        })
    );

    return (response.Datapoints || []).map((dp) => ({
        timestamp: dp.Timestamp || new Date(),
        value: dp.Sum || dp.Average || dp.Maximum || 0,
    }));
}

/**
 * List metrics in a namespace
 */
export async function listMetrics(
    namespace?: string
): Promise<Array<{ metricName: string; namespace: string }>> {
    const response = await metricsClient.send(
        new ListMetricsCommand({
            Namespace: namespace,
        })
    );

    return (response.Metrics || []).map((metric) => ({
        metricName: metric.MetricName || '',
        namespace: metric.Namespace || '',
    }));
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a structured log event with defaults
 */
export function createStructuredLogEvent(
    overrides: Partial<StructuredLogEvent> = {}
): StructuredLogEvent {
    return {
        level: 'INFO',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        requestId: `req-${Date.now()}`,
        functionName: 'TestFunction',
        ...overrides,
    };
}

/**
 * Setup test log group and stream
 */
export async function setupTestLogGroup(
    logGroupName?: string,
    logStreamName?: string
): Promise<{ logGroupName: string; logStreamName: string }> {
    const groupName = logGroupName || logsConfig.testLogGroup;
    const streamName = logStreamName || `test-stream-${Date.now()}`;

    await ensureLogGroupExists(groupName);
    await createLogStream(groupName, streamName);

    return { logGroupName: groupName, logStreamName: streamName };
}

/**
 * Cleanup test log group
 */
export async function cleanupTestLogGroup(logGroupName?: string): Promise<void> {
    await deleteLogGroup(logGroupName || logsConfig.testLogGroup);
}

/**
 * Wait for log events to be available (eventual consistency)
 */
export async function waitForLogEvents(
    logGroupName: string,
    logStreamName: string,
    expectedCount: number,
    timeoutMs: number = 5000
): Promise<Array<{ timestamp: number; message: string }>> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const events = await getLogEvents(logGroupName, logStreamName);
        if (events.length >= expectedCount) {
            return events;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Return whatever we have after timeout
    return getLogEvents(logGroupName, logStreamName);
}
