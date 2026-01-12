
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { instrumentClient, metrics, resetMetrics } from './telemetry';

// Set Env Vars for Lambda
process.env.DYNAMODB_TABLE_CAMPAIGNS = 'pivotr-campaigns';
process.env.DYNAMODB_TABLE_LEADS = 'pivotr-leads';
process.env.SQS_SENDING_QUEUE_URL = 'http://localhost:4566/000000000000/sending-queue';
process.env.SQS_VERIFICATION_QUEUE_URL = 'http://localhost:4566/000000000000/verification-queue';
process.env.AWS_REGION = 'us-east-1';

// Mock the DynamoDB Client BEFORE importing the lambda
const realDynamoClient = new DynamoDBClient({
    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
    region: 'us-east-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
});

// Instrument the real client so we can use it for seeding
instrumentClient(realDynamoClient);

vi.mock('@aws-sdk/client-dynamodb', async (importOriginal) => {
    const mod = await importOriginal<typeof import('@aws-sdk/client-dynamodb')>();
    
    // We define the class inside the factory to avoid hoisting issues
    // It must NOT reference outer variables like 'realDynamoClient'
    return {
        ...mod,
        DynamoDBClient: class MockDynamoDBClient extends mod.DynamoDBClient {
            constructor(config: any) {
                // Force connection to LocalStack regardless of what the Lambda asks for
                super({
                    ...config,
                    endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
                    region: 'us-east-1',
                    credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
                });

                // Add instrumentation middleware
                this.middlewareStack.add(
                    (next: any, context: any) => async (args: any) => {
                        const start = performance.now();
                        const result = await next(args);
                        const duration = performance.now() - start;

                        // Dynamically import metrics to avoid hoisting issues with outer scope variables
                        const { metrics } = await import('./telemetry');

                        const output = result?.output || {};
                        const tableName = args.input.TableName;
                        
                        // Extract capacity
                        const capacity = output?.ConsumedCapacity;
                        let totalCapacity = 0;
                        if (capacity) {
                            if (Array.isArray(capacity)) {
                                totalCapacity = capacity.reduce((acc: any, c: any) => acc + (c.CapacityUnits || 0), 0);
                            } else {
                                totalCapacity = capacity.CapacityUnits || 0;
                            }
                        }

                        metrics.push({
                            operation: context.commandName || 'Unknown',
                            tableName,
                            consumedCapacity: totalCapacity,
                            count: output?.Count,
                            scannedCount: output?.ScannedCount,
                            timestamp: Date.now(),
                            durationMs: duration
                        });

                        return result;
                    },
                    {
                        step: 'deserialize',
                        name: 'performanceTelemetry',
                        priority: 'low'
                    }
                );
            }
        }
    };
});

// Mock SQS to avoid network errors during test
vi.mock('@aws-sdk/client-sqs', async (importOriginal) => {
     const mod = await importOriginal<typeof import('@aws-sdk/client-sqs')>();
     return {
         ...mod,
         SQSClient: class MockSQSClient {
             constructor(config: any) {}
             async send(command: any) {
                return { Attributes: { ApproximateNumberOfMessages: '0' } };
             }
         }
     };
});

// Import the lambda handler AFTER mocking
// import { handler } from '../../lambda/campaign-processor/src/index';

const docClient = DynamoDBDocumentClient.from(realDynamoClient);

const CAMPAIGNS_TABLE = 'pivotr-campaigns';
const LEADS_TABLE = 'pivotr-leads';

async function seedCampaign(id: string, status: string = 'RUNNING') {
    // ... same as before
    const campaign = {
        id,
        name: `Perf Test ${id}`,
        status,
        schedule: {
            timezone: 'UTC',
            scheduledDates: [new Date().toISOString().split('T')[0]], // Today
            workingHours: { start: "00:00", end: "23:59" },
            dailyLimit: 10000,
            batchSize: 100
        },
        delayConfig: {
            minDelayMs: 0,
            maxDelayMs: 0
        },
        template: { subject: 'Hi', body: 'Hello' },
        senderEmail: 'test@example.com',
        senderName: 'Tester',
        metrics: { sentToday: 0 }
    };
    
    await docClient.send(new PutCommand({
        TableName: CAMPAIGNS_TABLE,
        Item: campaign
    }));
}

async function seedLeads(campaignId: string, count: number) {
   // ... same as before
    // Write in batches of 25
    const chunks: any[][] = [];
    const chunk_size = 25;
    
    // Generate items
    const items: any[] = [];
    for (let i = 0; i < count; i++) {
        items.push({
            PutRequest: {
                Item: {
                    id: `lead-${campaignId}-${i}`,
                    campaignId,
                    email: `user${i}@example.com`,
                    status: 'QUEUED',
                    verificationStatus: 'VERIFIED',
                    fullName: `User ${i}`
                }
            }
        });
    }

    // Split into chunks
    for (let i = 0; i < items.length; i += chunk_size) {
        chunks.push(items.slice(i, i + chunk_size));
    }

    // Write chunks
    // We use the real client directly to avoid polluting metrics with seed data
    // But wait, realClient IS instrumented. We should temporarily disable metrics or clear them after seeding.
    for (const chunk of chunks) {
         await docClient.send(new BatchWriteCommand({
             RequestItems: {
                 [LEADS_TABLE]: chunk
             }
         }));
    }
}

describe('Campaign Processor Performance', () => {
    
    beforeEach(async () => {
        resetMetrics();
        // Set Env Vars for Lambda (Needs to happen before import)
        process.env.DYNAMODB_TABLE_CAMPAIGNS = 'pivotr-campaigns';
        process.env.DYNAMODB_TABLE_LEADS = 'pivotr-leads';
        process.env.SQS_SENDING_QUEUE_URL = 'http://localhost:4566/000000000000/sending-queue';
        process.env.SQS_VERIFICATION_QUEUE_URL = 'http://localhost:4566/000000000000/verification-queue';
        process.env.AWS_REGION = 'us-east-1';
        process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
    });

    it('should process 50 leads with minimal DynamoDB calls', async () => {
        // Dynamically import handler to ensure env vars are picked up
        const { handler } = await import('../../lambda/campaign-processor/src/index');

        const campaignId = `perf-c1-${Date.now()}`;
        const leadCount = 50;

        await seedCampaign(campaignId);
        await seedLeads(campaignId, leadCount);
        
        // Clear metrics from seeding
        resetMetrics();

        // Invoke Lambda
        await handler({ 
            time: new Date().toISOString(),
            version: '0',
            id: 'test',
            'detail-type': 'Scheduled Event',
            source: 'aws.events',
            account: '123',
            region: 'us-east-1',
            resources: [],
            detail: {}
        } as any, {} as any, () => {});

        // Debug logging
        console.log('Raw Metrics:', JSON.stringify(metrics, null, 2));

        // Analyze Metrics
        const campaignScans = metrics.filter(m => m.tableName === CAMPAIGNS_TABLE && m.operation === 'ScanCommand');
        const leadQueries = metrics.filter(m => m.tableName === LEADS_TABLE && m.operation === 'QueryCommand');
        const leadUpdates = metrics.filter(m => m.tableName === LEADS_TABLE && m.operation === 'UpdateItemCommand');
        const leadBatchWrites = metrics.filter(m => m.operation === 'BatchWriteItemCommand'); 

        console.log('Metrics Summary:', {
            totalCalls: metrics.length,
            campaignScans: campaignScans.length,
            leadQueries: leadQueries.length,
            leadUpdates: leadUpdates.length,
            leadBatchWrites: leadBatchWrites.length,
            totalConsumed: metrics.reduce((acc, m) => acc + (m.consumedCapacity || 0), 0)
        });

        // Assertions
        expect(campaignScans.length).toBeGreaterThanOrEqual(1); 
        expect(leadQueries.length).toBeGreaterThan(0); 
        
        // CRITICAL CHECK: We should use BatchWrite instead of N+1 Updates
        // UpdateItem count should be small (only for campaign stats, not leads)
        expect(leadBatchWrites.length).toBeGreaterThan(0);
        expect(leadUpdates.length).toBeLessThan(leadCount); 

    }, 30000); // 30s timeout
});
