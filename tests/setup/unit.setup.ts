/**
 * Unit Test Setup
 *
 * Runs before unit tests only.
 * Ensures complete isolation from AWS services.
 */

import { beforeAll, vi } from 'vitest';

// =============================================================================
// AWS SDK Mocking
// =============================================================================

beforeAll(() => {
    // Ensure unit tests cannot accidentally call real AWS services
    process.env.AWS_ENDPOINT_URL = 'http://localhost:0'; // Invalid endpoint

    // Mock AWS SDK clients at module level
    // This prevents any accidental network calls
    vi.mock('@aws-sdk/client-dynamodb', async (importOriginal) => {
        const original = await importOriginal<typeof import('@aws-sdk/client-dynamodb')>();
        return {
            ...original,
            DynamoDBClient: vi.fn().mockImplementation(() => ({
                send: vi.fn().mockRejectedValue(
                    new Error('DynamoDB should be mocked in unit tests')
                ),
                destroy: vi.fn(),
            })),
        };
    });

    vi.mock('@aws-sdk/client-sqs', async (importOriginal) => {
        const original = await importOriginal<typeof import('@aws-sdk/client-sqs')>();
        return {
            ...original,
            SQSClient: vi.fn().mockImplementation(() => ({
                send: vi.fn().mockRejectedValue(
                    new Error('SQS should be mocked in unit tests')
                ),
                destroy: vi.fn(),
            })),
        };
    });

    vi.mock('@aws-sdk/client-ses', async (importOriginal) => {
        const original = await importOriginal<typeof import('@aws-sdk/client-ses')>();
        return {
            ...original,
            SESClient: vi.fn().mockImplementation(() => ({
                send: vi.fn().mockRejectedValue(
                    new Error('SES should be mocked in unit tests')
                ),
                destroy: vi.fn(),
            })),
        };
    });

    vi.mock('@aws-sdk/client-sns', async (importOriginal) => {
        const original = await importOriginal<typeof import('@aws-sdk/client-sns')>();
        return {
            ...original,
            SNSClient: vi.fn().mockImplementation(() => ({
                send: vi.fn().mockRejectedValue(
                    new Error('SNS should be mocked in unit tests')
                ),
                destroy: vi.fn(),
            })),
        };
    });
});

// =============================================================================
// Logger Mocking
// =============================================================================

// Mock Lambda Powertools Logger to prevent console noise
vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: vi.fn().mockImplementation(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        addContext: vi.fn(),
    })),
}));
