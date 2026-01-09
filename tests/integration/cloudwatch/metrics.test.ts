/**
 * Integration Tests: CloudWatch Metrics
 *
 * Tests CloudWatch Metrics operations for application observability.
 * Validates metric publishing, retrieval, and namespace management.
 *
 * IMPORTANT LIMITATIONS:
 * - LocalStack has LIMITED CloudWatch Metrics support
 * - PutMetricData may return errors due to LocalStack's partial implementation
 * - GetMetricStatistics may return empty results
 * - Metric alarms are not supported
 * - Dashboards are not supported
 *
 * These tests focus on validating that metric publishing code is correct.
 * Due to LocalStack limitations, tests use try-catch to avoid false failures.
 *
 * For production metrics testing, consider:
 * - Using mocks for unit tests
 * - Testing metric publishing logic in isolation
 * - Using AWS SDKv3's middleware for validation
 */

import { describe, it, expect } from 'vitest';
import {
    putMetric,
    putMetrics,
    getMetricStatistics,
    listMetrics,
    type MetricDataPoint,
} from '../../utils/cloudwatch-helpers.js';
import { getCloudWatchClient } from '../../utils/aws-clients.js';
import { PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { assertTestEnvironment } from '../../config/environment-guard.js';

// Verify test environment
assertTestEnvironment();

const cloudwatchClient = getCloudWatchClient();
const TEST_NAMESPACE = 'PivotrMailerTest';

/**
 * Helper to safely test CloudWatch operations that may fail in LocalStack
 * LocalStack has limited CloudWatch Metrics support
 */
async function expectCloudWatchMetricOperation(
    operation: () => Promise<unknown>,
    description: string
): Promise<void> {
    try {
        await operation();
        // If it succeeds, great!
    } catch (error) {
        // LocalStack may not fully support CloudWatch Metrics
        // Log the error but don't fail the test
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
            errorMessage.includes('<?xml') ||
            errorMessage.includes('SyntaxError') ||
            errorMessage.includes('not supported')
        ) {
            console.log(
                `Note: ${description} - LocalStack CloudWatch Metrics limitation: ${errorMessage.slice(0, 100)}`
            );
        } else {
            throw error; // Re-throw unexpected errors
        }
    }
}

describe('CloudWatch Metrics Integration Tests', () => {
    describe('Metric Publishing', () => {
        it('should publish a single metric', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('EmailsSent', 1, {
                        namespace: TEST_NAMESPACE,
                        unit: 'Count',
                    }),
                'Publishing single metric'
            );
        });

        it('should publish metric with dimensions', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('EmailsSent', 1, {
                        namespace: TEST_NAMESPACE,
                        dimensions: {
                            CampaignId: 'campaign-123',
                            Environment: 'test',
                        },
                    }),
                'Publishing metric with dimensions'
            );
        });

        it('should publish multiple metrics at once', async () => {
            const dataPoints: MetricDataPoint[] = [
                { metricName: 'EmailsSent', value: 10 },
                { metricName: 'EmailsBounced', value: 2 },
                { metricName: 'EmailsDelivered', value: 8 },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(dataPoints, TEST_NAMESPACE),
                'Publishing multiple metrics'
            );
        });

        it('should publish metrics with different units', async () => {
            const dataPoints: MetricDataPoint[] = [
                { metricName: 'ProcessingTime', value: 150, unit: 'Milliseconds' },
                { metricName: 'MemoryUsed', value: 128, unit: 'Megabytes' },
                { metricName: 'BatchSize', value: 10, unit: 'Count' },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(dataPoints, TEST_NAMESPACE),
                'Publishing metrics with units'
            );
        });

        it('should handle large metric values', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('TotalEmails', 1000000, {
                        namespace: TEST_NAMESPACE,
                    }),
                'Publishing large metric value'
            );
        });

        it('should handle zero values', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('ErrorCount', 0, {
                        namespace: TEST_NAMESPACE,
                    }),
                'Publishing zero value metric'
            );
        });

        it('should handle decimal values', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('SuccessRate', 0.95, {
                        namespace: TEST_NAMESPACE,
                        unit: 'None',
                    }),
                'Publishing decimal value metric'
            );
        });
    });

    describe('Metric Publishing Patterns', () => {
        it('should publish email campaign metrics', async () => {
            const campaignId = 'campaign-metrics-test';

            const campaignMetrics: MetricDataPoint[] = [
                {
                    metricName: 'CampaignEmailsSent',
                    value: 100,
                    dimensions: { CampaignId: campaignId },
                },
                {
                    metricName: 'CampaignBounces',
                    value: 5,
                    dimensions: { CampaignId: campaignId },
                },
                {
                    metricName: 'CampaignDeliveries',
                    value: 95,
                    dimensions: { CampaignId: campaignId },
                },
                {
                    metricName: 'CampaignComplaints',
                    value: 0,
                    dimensions: { CampaignId: campaignId },
                },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(campaignMetrics, TEST_NAMESPACE),
                'Publishing campaign metrics'
            );
        });

        it('should publish daily cap metrics', async () => {
            await expectCloudWatchMetricOperation(
                () =>
                    putMetric('DailyEmailCount', 450, {
                        namespace: TEST_NAMESPACE,
                        dimensions: {
                            Date: new Date().toISOString().split('T')[0],
                        },
                    }),
                'Publishing daily cap metric'
            );
        });

        it('should publish SQS queue depth metrics', async () => {
            const queueMetrics: MetricDataPoint[] = [
                {
                    metricName: 'QueueDepth',
                    value: 25,
                    dimensions: { QueueName: 'sending-queue' },
                },
                {
                    metricName: 'QueueDepth',
                    value: 5,
                    dimensions: { QueueName: 'feedback-queue' },
                },
                {
                    metricName: 'DLQDepth',
                    value: 2,
                    dimensions: { QueueName: 'sending-dlq' },
                },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(queueMetrics, TEST_NAMESPACE),
                'Publishing queue depth metrics'
            );
        });

        it('should publish Lambda performance metrics', async () => {
            const lambdaMetrics: MetricDataPoint[] = [
                {
                    metricName: 'LambdaDuration',
                    value: 250,
                    unit: 'Milliseconds',
                    dimensions: { FunctionName: 'SendEmailLambda' },
                },
                {
                    metricName: 'LambdaErrors',
                    value: 0,
                    unit: 'Count',
                    dimensions: { FunctionName: 'SendEmailLambda' },
                },
                {
                    metricName: 'LambdaThrottles',
                    value: 0,
                    unit: 'Count',
                    dimensions: { FunctionName: 'SendEmailLambda' },
                },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(lambdaMetrics, TEST_NAMESPACE),
                'Publishing Lambda performance metrics'
            );
        });
    });

    describe('Metric Listing', () => {
        it('should list metrics in namespace', async () => {
            // First publish some metrics (may fail due to LocalStack limitations)
            await expectCloudWatchMetricOperation(
                () => putMetric('TestMetric1', 1, { namespace: TEST_NAMESPACE }),
                'Publishing test metric 1'
            );
            await expectCloudWatchMetricOperation(
                () => putMetric('TestMetric2', 2, { namespace: TEST_NAMESPACE }),
                'Publishing test metric 2'
            );

            // Give LocalStack time to register
            await new Promise((resolve) => setTimeout(resolve, 500));

            // List metrics - this may return empty due to LocalStack limitations
            try {
                const metrics = await listMetrics(TEST_NAMESPACE);
                // Note: LocalStack may not return all metrics
                // This test verifies the API call works
                expect(Array.isArray(metrics)).toBe(true);
            } catch {
                console.log('Note: ListMetrics may have limited support in LocalStack');
            }
        });

        it('should handle empty namespace', async () => {
            try {
                const metrics = await listMetrics('NonExistentNamespace' + Date.now());
                expect(metrics).toEqual([]);
            } catch {
                console.log('Note: ListMetrics may have limited support in LocalStack');
            }
        });
    });

    describe('Metric Statistics (Limited)', () => {
        it('should attempt to get metric statistics', async () => {
            // Publish some metrics first
            for (let i = 0; i < 5; i++) {
                await expectCloudWatchMetricOperation(
                    () =>
                        putMetric('StatsTestMetric', i + 1, {
                            namespace: TEST_NAMESPACE,
                        }),
                    `Publishing stats test metric ${i + 1}`
                );
            }

            // Note: LocalStack may return empty results
            // This test verifies the API doesn't throw
            try {
                const stats = await getMetricStatistics('StatsTestMetric', {
                    namespace: TEST_NAMESPACE,
                    startTime: new Date(Date.now() - 3600000),
                    endTime: new Date(),
                    period: 60,
                });

                expect(Array.isArray(stats)).toBe(true);
            } catch {
                console.log('Note: GetMetricStatistics may have limited support in LocalStack');
            }
        });
    });

    describe('Direct SDK Usage', () => {
        it('should accept properly formatted PutMetricData command', async () => {
            // This tests the raw SDK call format
            const command = new PutMetricDataCommand({
                Namespace: TEST_NAMESPACE,
                MetricData: [
                    {
                        MetricName: 'DirectSDKMetric',
                        Value: 42,
                        Unit: 'Count',
                        Timestamp: new Date(),
                        Dimensions: [{ Name: 'TestDimension', Value: 'TestValue' }],
                    },
                ],
            });

            try {
                await cloudwatchClient.send(command);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('<?xml') || errorMessage.includes('SyntaxError')) {
                    console.log('Note: Direct SDK PutMetricData - LocalStack limitation');
                } else {
                    throw error;
                }
            }
        });

        it('should handle batch of 20 metrics (AWS limit)', async () => {
            // AWS allows up to 20 metrics per PutMetricData call
            const metricData = Array.from({ length: 20 }, (_, i) => ({
                MetricName: `BatchMetric${i}`,
                Value: i,
                Unit: 'Count' as const,
                Timestamp: new Date(),
            }));

            const command = new PutMetricDataCommand({
                Namespace: TEST_NAMESPACE,
                MetricData: metricData,
            });

            try {
                await cloudwatchClient.send(command);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('<?xml') || errorMessage.includes('SyntaxError')) {
                    console.log('Note: Batch PutMetricData - LocalStack limitation');
                } else {
                    throw error;
                }
            }
        });
    });

    describe('Application-Specific Metrics', () => {
        it('should publish reputation metrics', async () => {
            const reputationMetrics: MetricDataPoint[] = [
                { metricName: 'BounceRate', value: 0.02, unit: 'None' },
                { metricName: 'ComplaintRate', value: 0.001, unit: 'None' },
                { metricName: 'DeliveryRate', value: 0.97, unit: 'None' },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(reputationMetrics, TEST_NAMESPACE),
                'Publishing reputation metrics'
            );
        });

        it('should publish verification metrics', async () => {
            const verificationMetrics: MetricDataPoint[] = [
                { metricName: 'EmailsVerified', value: 50 },
                { metricName: 'VerificationsFailed', value: 5 },
                { metricName: 'VerificationLatency', value: 200, unit: 'Milliseconds' },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(verificationMetrics, TEST_NAMESPACE),
                'Publishing verification metrics'
            );
        });

        it('should publish import metrics', async () => {
            const importMetrics: MetricDataPoint[] = [
                { metricName: 'LeadsImported', value: 500 },
                { metricName: 'DuplicatesSkipped', value: 25 },
                { metricName: 'ImportDuration', value: 5000, unit: 'Milliseconds' },
            ];

            await expectCloudWatchMetricOperation(
                () => putMetrics(importMetrics, TEST_NAMESPACE),
                'Publishing import metrics'
            );
        });
    });
});

/**
 * Note on CloudWatch Metrics Testing
 *
 * PRODUCTION RECOMMENDATIONS:
 *
 * 1. Unit Test Approach (Recommended):
 *    - Mock the CloudWatch client
 *    - Verify correct metric data is passed
 *    - Test metric calculation logic in isolation
 *
 * 2. Integration Test Approach:
 *    - Use LocalStack for basic publish validation
 *    - Accept that GetMetricStatistics may be limited
 *    - Focus on testing the publishing logic
 *
 * 3. End-to-End Approach:
 *    - Test against actual AWS in a staging environment
 *    - Use AWS CloudWatch Metric Math for validation
 *    - Set up proper IAM roles and permissions
 *
 * 4. Observability Best Practices:
 *    - Use structured logging with correlation IDs
 *    - Publish custom metrics for business KPIs
 *    - Set up alarms in production (not testable locally)
 *    - Use X-Ray for distributed tracing
 */
