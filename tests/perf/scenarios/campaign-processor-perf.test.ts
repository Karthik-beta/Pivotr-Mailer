
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DynamoSpy } from '../utils/dynamo-spy.js';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Define mockSend first and hoist it
const { mockSend, fakeClient, mockSqsSend } = vi.hoisted(() => {
    const mock = vi.fn().mockImplementation(async (command: any) => {
        if (command.constructor.name === 'ScanCommand') {
            return { Items: [] };
        }
        return {};
    });

    const client = {
        send: mock,
        config: {},
        middlewareStack: { add: () => {}, remove: () => {} }
    };

    const sqsMock = vi.fn().mockResolvedValue({});

    return { mockSend: mock, fakeClient: client, mockSqsSend: sqsMock };
});

// Spy instance to track calls
let spy: DynamoSpy;

// Initialize spy with the hoisted client
spy = new DynamoSpy(fakeClient as unknown as DynamoDBDocumentClient);

// Mock the DynamoDB Client Module
vi.mock('@aws-sdk/client-dynamodb', () => {
    return {
        DynamoDBClient: class MockDynamoDBClient {
            constructor() {}
            send() { return {}; }
        },
    };
});

// Mock SQS Client
vi.mock('@aws-sdk/client-sqs', () => {
    return {
        SQSClient: class MockSQSClient {
            constructor() {}
            send = mockSqsSend;
        },
        SendMessageBatchCommand: class {},
        GetQueueAttributesCommand: class {},
    };
});

vi.mock('@aws-sdk/lib-dynamodb', async () => {
    const actual = await vi.importActual('@aws-sdk/lib-dynamodb');
    return {
        ...actual,
        DynamoDBDocumentClient: {
            from: () => fakeClient,
        },
        ScanCommand: (actual as any).ScanCommand,
        QueryCommand: (actual as any).QueryCommand,
        GetCommand: (actual as any).GetCommand,
        UpdateCommand: (actual as any).UpdateCommand,
        BatchWriteCommand: (actual as any).BatchWriteCommand,
    };
});

// Mock logger to reduce noise
vi.mock('@aws-lambda-powertools/logger', () => ({
    Logger: class {
        info() {}
        error() {}
        warn() {}
        debug() {}
    }
}));

// Set Environment Variables BEFORE importing lambda
process.env.SQS_SENDING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/sending-queue';
process.env.SQS_VERIFICATION_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/verification-queue';

// Import the Lambda handler AFTER mocking and setting env
import { handler } from '../../../lambda/campaign-processor/src/index.js';

describe('Performance: Campaign Processor', () => {
    beforeEach(() => {
        spy.attach();
        spy.reset();
        mockSend.mockClear();
    });

    afterEach(() => {
        spy.detach();
    });

    it('Scenario A: Idle System (No Campaigns)', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] });

        await handler({ 
            version: '0', 
            id: '1', 
            'detail-type': 'Scheduled Event', 
            source: 'aws.events', 
            account: '123', 
            time: new Date().toISOString(), 
            region: 'us-east-1', 
            resources: [], 
            detail: {} 
        }, {
            callbackWaitsForEmptyEventLoop: false,
            functionName: 'test',
            functionVersion: '1',
            invokedFunctionArn: 'arn',
            memoryLimitInMB: '128',
            awsRequestId: 'req-1',
            logGroupName: 'log',
            logStreamName: 'stream',
            getRemainingTimeInMillis: () => 1000,
            done: () => {},
            fail: () => {},
            succeed: () => {},
        }, () => {});

        const report = spy.generateReport();
        expect(report.totalCalls).toBe(1); 
        expect(report.duplicates).toBe(0);
        const stats = spy.getStats();
        expect(stats[0].operation).toBe('Scan');
    });

    it('Scenario B: Loop of Death Check (100 Leads)', async () => {
        // 1. Scan Campaigns -> Returns 1 Running Campaign
        // CANONICAL CONFIGURATION (Always Runs)
        mockSend.mockResolvedValueOnce({ 
            Items: [{ 
                id: 'camp-1', 
                status: 'RUNNING', 
                name: 'Canonical Perf Test Campaign',
                schedule: {
                    timezone: 'UTC',
                    scheduledDates: ['2026-01-12'], 
                    dailyLimit: 10000,
                    workingHours: { start: '00:00', end: '23:59' }, // ALWAYS OPEN
                    peakHours: { start: '00:00', end: '23:59' }
                },
                delayConfig: {
                    minDelayMs: 0,
                    maxDelayMs: 0
                }
            }] 
        });

        // 2. Query Leads -> Returns 100 Queued Leads
        const leads = Array.from({ length: 100 }, (_, i) => ({
            id: `lead-${i}`,
            campaignId: 'camp-1',
            status: 'QUEUED',
            verificationStatus: 'VERIFIED', // Ensure they are ready to send to avoid verification queue logic
            email: `user${i}@example.com`,
            fullName: `User ${i}`,
            companyName: 'Corp'
        }));
        
        mockSend.mockResolvedValueOnce({ Items: leads });

        // 3. Update Leads & SQS
        // The processor will call UpdateCommand for leads.
        // We mock default success for all subsequent calls.
        mockSend.mockResolvedValue({}); 

        await handler({ 
            version: '0', 
            id: '1', 
            'detail-type': 'Scheduled Event', 
            source: 'aws.events', 
            account: '123', 
            time: '2026-01-12T07:42:00.000Z', // Fix time to match our date assumption
            region: 'us-east-1', 
            resources: [], 
            detail: {} 
        }, {} as any, () => {});

        const report = spy.generateReport();
        console.log(`Measured Calls for 100 leads: ${report.totalCalls}`);
        
        // Assertions
        // If > 20, it's inefficient (Loop of Death).
        // We expect this to FAIL currently because the implementation likely loops updates.
        expect(report.totalCalls).toBeLessThan(20); 
    });
});

