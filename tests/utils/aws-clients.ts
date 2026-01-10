/**
 * AWS Client Factories for Testing
 *
 * Creates pre-configured AWS SDK clients for use in tests.
 * Automatically uses LocalStack endpoint for integration tests.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';
import { SESClient } from '@aws-sdk/client-ses';
import { S3Client } from '@aws-sdk/client-s3';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { getAWSClientConfig, testConfig } from '../config/test-config.js';

// Cached clients for reuse
let _dynamoClient: DynamoDBClient | null = null;
let _docClient: DynamoDBDocumentClient | null = null;
let _sqsClient: SQSClient | null = null;
let _snsClient: SNSClient | null = null;
let _sesClient: SESClient | null = null;
let _s3Client: S3Client | null = null;
let _cloudwatchClient: CloudWatchClient | null = null;
let _cloudwatchLogsClient: CloudWatchLogsClient | null = null;

/**
 * Get or create DynamoDB client
 */
export function getDynamoDBClient(): DynamoDBClient {
    if (!_dynamoClient) {
        _dynamoClient = new DynamoDBClient(getAWSClientConfig());
    }
    return _dynamoClient;
}

/**
 * Get or create DynamoDB Document client
 */
export function getDocumentClient(): DynamoDBDocumentClient {
    if (!_docClient) {
        _docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
            marshallOptions: {
                removeUndefinedValues: true,
                convertEmptyValues: false,
            },
        });
    }
    return _docClient;
}

/**
 * Get or create SQS client
 */
export function getSQSClient(): SQSClient {
    if (!_sqsClient) {
        _sqsClient = new SQSClient(getAWSClientConfig());
    }
    return _sqsClient;
}

/**
 * Get or create SNS client
 */
export function getSNSClient(): SNSClient {
    if (!_snsClient) {
        _snsClient = new SNSClient(getAWSClientConfig());
    }
    return _snsClient;
}

/**
 * Get or create SES client
 */
export function getSESClient(): SESClient {
    if (!_sesClient) {
        _sesClient = new SESClient(getAWSClientConfig());
    }
    return _sesClient;
}

/**
 * Get or create CloudWatch client
 */
export function getCloudWatchClient(): CloudWatchClient {
    if (!_cloudwatchClient) {
        _cloudwatchClient = new CloudWatchClient(getAWSClientConfig());
    }
    return _cloudwatchClient;
}

/**
 * Get or create CloudWatch Logs client
 */
export function getCloudWatchLogsClient(): CloudWatchLogsClient {
    if (!_cloudwatchLogsClient) {
        _cloudwatchLogsClient = new CloudWatchLogsClient(getAWSClientConfig());
    }
    return _cloudwatchLogsClient;
}

/**
 * Get or create S3 client
 */
export function getS3Client(): S3Client {
    if (!_s3Client) {
        _s3Client = new S3Client({
            ...getAWSClientConfig(),
            forcePathStyle: true, // Required for LocalStack
        });
    }
    return _s3Client;
}

/**
 * Reset all cached clients
 * Useful for test isolation
 */
export function resetClients(): void {
    _dynamoClient?.destroy();
    _sqsClient?.destroy();
    _snsClient?.destroy();
    _sesClient?.destroy();
    _s3Client?.destroy();
    _cloudwatchClient?.destroy();
    _cloudwatchLogsClient?.destroy();

    _dynamoClient = null;
    _docClient = null;
    _sqsClient = null;
    _snsClient = null;
    _sesClient = null;
    _s3Client = null;
    _cloudwatchClient = null;
    _cloudwatchLogsClient = null;
}

/**
 * Get all table names from config
 */
export function getTableNames() {
    return testConfig.dynamodb.tables;
}

/**
 * Get all queue URLs from config
 */
export function getQueueUrls() {
    return testConfig.sqs.queues;
}

/**
 * Get all topic ARNs from config
 */
export function getTopicArns() {
    return testConfig.sns.topics;
}

/**
 * Get S3 bucket names from config
 */
export function getS3Buckets() {
    return testConfig.s3.buckets;
}

/**
 * Get CloudWatch Logs config from config
 */
export function getCloudWatchLogsConfig() {
    return testConfig.cloudwatch.logs;
}

// Export types for convenience
export type { DynamoDBClient, DynamoDBDocumentClient, SQSClient, SNSClient, SESClient, S3Client, CloudWatchClient, CloudWatchLogsClient };
