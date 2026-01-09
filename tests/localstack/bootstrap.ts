/**
 * LocalStack Bootstrap Script (TypeScript)
 *
 * Programmatically creates all AWS resources required for local testing.
 * Can be run directly or imported by test setup files.
 *
 * Usage:
 *   bun run tests/localstack/bootstrap.ts
 *   - or -
 *   import { bootstrapLocalStack } from './tests/localstack/bootstrap';
 */

import {
    DynamoDBClient,
    CreateTableCommand,
    DescribeTableCommand,
    BillingMode,
    KeyType,
    ScalarAttributeType,
    ProjectionType,
} from '@aws-sdk/client-dynamodb';
import {
    SQSClient,
    CreateQueueCommand,
    GetQueueAttributesCommand,
    GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import {
    SNSClient,
    CreateTopicCommand,
    SubscribeCommand,
} from '@aws-sdk/client-sns';
import {
    SESClient,
    VerifyEmailIdentityCommand,
    CreateConfigurationSetCommand,
} from '@aws-sdk/client-ses';
import {
    S3Client,
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketVersioningCommand,
    PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';
import {
    CloudWatchLogsClient,
    CreateLogGroupCommand,
    DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

// Configuration
const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const REGION = process.env.AWS_REGION || 'us-east-1';

// AWS SDK Configuration for LocalStack
const clientConfig = {
    endpoint: LOCALSTACK_ENDPOINT,
    region: REGION,
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
    },
};

// Initialize clients
const dynamoClient = new DynamoDBClient(clientConfig);
const sqsClient = new SQSClient(clientConfig);
const snsClient = new SNSClient(clientConfig);
const sesClient = new SESClient(clientConfig);
const s3Client = new S3Client({ ...clientConfig, forcePathStyle: true });
const logsClient = new CloudWatchLogsClient(clientConfig);

// Table configurations matching CDK stack
const DYNAMODB_TABLES = {
    leads: {
        tableName: 'pivotr-leads',
        partitionKey: { name: 'id', type: ScalarAttributeType.S },
        gsis: [
            {
                indexName: 'EmailIndex',
                keySchema: [{ attributeName: 'email', keyType: KeyType.HASH }],
                projection: { projectionType: ProjectionType.ALL },
            },
            {
                indexName: 'StatusIndex',
                keySchema: [{ attributeName: 'status', keyType: KeyType.HASH }],
                projection: { projectionType: ProjectionType.ALL },
            },
            {
                indexName: 'CampaignIndex',
                keySchema: [
                    { attributeName: 'campaignId', keyType: KeyType.HASH },
                    { attributeName: 'status', keyType: KeyType.RANGE },
                ],
                projection: { projectionType: ProjectionType.ALL },
            },
        ],
        additionalAttributes: [
            { attributeName: 'email', attributeType: ScalarAttributeType.S },
            { attributeName: 'status', attributeType: ScalarAttributeType.S },
            { attributeName: 'campaignId', attributeType: ScalarAttributeType.S },
        ],
    },
    campaigns: {
        tableName: 'pivotr-campaigns',
        partitionKey: { name: 'id', type: ScalarAttributeType.S },
    },
    metrics: {
        tableName: 'pivotr-metrics',
        partitionKey: { name: 'pk', type: ScalarAttributeType.S },
        sortKey: { name: 'sk', type: ScalarAttributeType.S },
    },
    logs: {
        tableName: 'pivotr-logs',
        partitionKey: { name: 'campaignId', type: ScalarAttributeType.S },
        sortKey: { name: 'timestamp', type: ScalarAttributeType.S },
        gsis: [
            {
                indexName: 'LeadLogsIndex',
                keySchema: [
                    { attributeName: 'leadId', keyType: KeyType.HASH },
                    { attributeName: 'timestamp', keyType: KeyType.RANGE },
                ],
                projection: { projectionType: ProjectionType.ALL },
            },
        ],
        additionalAttributes: [
            { attributeName: 'leadId', attributeType: ScalarAttributeType.S },
        ],
    },
    settings: {
        tableName: 'pivotr-settings',
        partitionKey: { name: 'key', type: ScalarAttributeType.S },
    },
};

const SQS_QUEUES = {
    sendingDlq: { name: 'sending-dlq' },
    feedbackDlq: { name: 'feedback-dlq' },
    verificationDlq: { name: 'verification-dlq' },
    sending: {
        name: 'sending-queue',
        visibilityTimeout: 35,
        dlqName: 'sending-dlq',
        maxReceiveCount: 3,
    },
    feedback: {
        name: 'feedback-queue',
        visibilityTimeout: 15,
        dlqName: 'feedback-dlq',
        maxReceiveCount: 5,
    },
    verification: {
        name: 'verification-queue',
        visibilityTimeout: 20,
        dlqName: 'verification-dlq',
        maxReceiveCount: 2,
    },
};

const SNS_TOPICS = {
    alarms: { name: 'pivotr-alarms' },
    sesFeedback: { name: 'pivotr-ses-feedback' },
};

const S3_BUCKETS = {
    auditLogs: {
        name: 'pivotr-audit-logs',
        versioning: true,
        lifecycleRules: true,
    },
};

const CLOUDWATCH_LOG_GROUPS = {
    test: { name: '/pivotr/test' },
    sendEmail: { name: '/aws/lambda/pivotr-send-email' },
    processFeedback: { name: '/aws/lambda/pivotr-process-feedback' },
    verifyEmail: { name: '/aws/lambda/pivotr-verify-email' },
    leadImport: { name: '/aws/lambda/pivotr-lead-import' },
    apiLeads: { name: '/aws/lambda/pivotr-api-leads' },
    apiCampaigns: { name: '/aws/lambda/pivotr-api-campaigns' },
    apiMetrics: { name: '/aws/lambda/pivotr-api-metrics' },
};

/**
 * Check if a DynamoDB table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
    try {
        await dynamoClient.send(new DescribeTableCommand({ TableName: tableName }));
        return true;
    } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
            return false;
        }
        throw error;
    }
}

/**
 * Create a DynamoDB table
 */
async function createTable(config: typeof DYNAMODB_TABLES.leads): Promise<void> {
    const { tableName, partitionKey, sortKey, gsis, additionalAttributes } = config;

    if (await tableExists(tableName)) {
        console.log(`  ✓ Table ${tableName} already exists`);
        return;
    }

    const attributeDefinitions = [
        { AttributeName: partitionKey.name, AttributeType: partitionKey.type },
    ];

    if (sortKey) {
        attributeDefinitions.push({
            AttributeName: sortKey.name,
            AttributeType: sortKey.type,
        });
    }

    if (additionalAttributes) {
        for (const attr of additionalAttributes) {
            attributeDefinitions.push({
                AttributeName: attr.attributeName,
                AttributeType: attr.attributeType,
            });
        }
    }

    const keySchema = [{ AttributeName: partitionKey.name, KeyType: KeyType.HASH }];
    if (sortKey) {
        keySchema.push({ AttributeName: sortKey.name, KeyType: KeyType.RANGE });
    }

    const globalSecondaryIndexes = gsis?.map((gsi) => ({
        IndexName: gsi.indexName,
        KeySchema: gsi.keySchema.map((k) => ({
            AttributeName: k.attributeName,
            KeyType: k.keyType,
        })),
        Projection: {
            ProjectionType: gsi.projection?.projectionType || ProjectionType.ALL,
        },
    }));

    await dynamoClient.send(
        new CreateTableCommand({
            TableName: tableName,
            AttributeDefinitions: attributeDefinitions,
            KeySchema: keySchema,
            BillingMode: BillingMode.PAY_PER_REQUEST,
            GlobalSecondaryIndexes: globalSecondaryIndexes?.length ? globalSecondaryIndexes : undefined,
        })
    );

    console.log(`  → Created table ${tableName}`);
}

/**
 * Get SQS queue ARN
 */
async function getQueueArn(queueName: string): Promise<string | undefined> {
    try {
        const urlResponse = await sqsClient.send(
            new GetQueueUrlCommand({ QueueName: queueName })
        );
        const attrResponse = await sqsClient.send(
            new GetQueueAttributesCommand({
                QueueUrl: urlResponse.QueueUrl,
                AttributeNames: ['QueueArn'],
            })
        );
        return attrResponse.Attributes?.QueueArn;
    } catch {
        return undefined;
    }
}

/**
 * Create SQS queues
 */
async function createQueues(): Promise<void> {
    // Create DLQs first
    for (const [key, config] of Object.entries(SQS_QUEUES)) {
        if (key.endsWith('Dlq')) {
            try {
                await sqsClient.send(new CreateQueueCommand({ QueueName: config.name }));
                console.log(`  → Created DLQ ${config.name}`);
            } catch (error: any) {
                if (error.name === 'QueueNameExists' || error.name === 'QueueAlreadyExists') {
                    console.log(`  ✓ DLQ ${config.name} already exists`);
                } else {
                    throw error;
                }
            }
        }
    }

    // Create main queues with redrive policies
    for (const [key, config] of Object.entries(SQS_QUEUES)) {
        if (!key.endsWith('Dlq') && 'dlqName' in config) {
            const dlqArn = await getQueueArn(config.dlqName);
            const attributes: Record<string, string> = {
                VisibilityTimeout: String(config.visibilityTimeout),
            };

            if (dlqArn) {
                attributes.RedrivePolicy = JSON.stringify({
                    deadLetterTargetArn: dlqArn,
                    maxReceiveCount: config.maxReceiveCount,
                });
            }

            try {
                await sqsClient.send(
                    new CreateQueueCommand({
                        QueueName: config.name,
                        Attributes: attributes,
                    })
                );
                console.log(`  → Created queue ${config.name}`);
            } catch (error: any) {
                if (error.name === 'QueueNameExists' || error.name === 'QueueAlreadyExists') {
                    console.log(`  ✓ Queue ${config.name} already exists`);
                } else {
                    throw error;
                }
            }
        }
    }
}

/**
 * Create SNS topics and subscriptions
 */
async function createTopics(): Promise<void> {
    const topicArns: Record<string, string> = {};

    for (const [key, config] of Object.entries(SNS_TOPICS)) {
        try {
            const response = await snsClient.send(
                new CreateTopicCommand({ Name: config.name })
            );
            topicArns[key] = response.TopicArn!;
            console.log(`  → Created topic ${config.name}`);
        } catch {
            console.log(`  ✓ Topic ${config.name} already exists`);
        }
    }

    // Subscribe feedback queue to SES feedback topic
    const feedbackQueueArn = await getQueueArn('feedback-queue');
    if (feedbackQueueArn && topicArns.sesFeedback) {
        try {
            await snsClient.send(
                new SubscribeCommand({
                    TopicArn: topicArns.sesFeedback,
                    Protocol: 'sqs',
                    Endpoint: feedbackQueueArn,
                })
            );
            console.log('  → Subscribed feedback queue to SES feedback topic');
        } catch {
            console.log('  ✓ Subscription already exists');
        }
    }
}

/**
 * Configure SES
 */
async function configureSES(): Promise<void> {
    const emails = ['noreply@pivotr.local', 'test@example.com'];

    for (const email of emails) {
        try {
            await sesClient.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
            console.log(`  → Verified email ${email}`);
        } catch {
            console.log(`  ✓ Email ${email} already verified`);
        }
    }

    try {
        await sesClient.send(
            new CreateConfigurationSetCommand({
                ConfigurationSetName: 'PivotrLocalConfigSet',
            })
        );
        console.log('  → Created configuration set PivotrLocalConfigSet');
    } catch {
        console.log('  ✓ Configuration set already exists');
    }
}

/**
 * Check if an S3 bucket exists
 */
async function bucketExists(bucketName: string): Promise<boolean> {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return true;
    } catch {
        return false;
    }
}

/**
 * Create S3 buckets with configuration
 */
async function createBuckets(): Promise<void> {
    for (const [key, config] of Object.entries(S3_BUCKETS)) {
        if (await bucketExists(config.name)) {
            console.log(`  ✓ Bucket ${config.name} already exists`);
            continue;
        }

        try {
            await s3Client.send(
                new CreateBucketCommand({
                    Bucket: config.name,
                })
            );
            console.log(`  → Created bucket ${config.name}`);

            // Enable versioning if configured
            if (config.versioning) {
                await s3Client.send(
                    new PutBucketVersioningCommand({
                        Bucket: config.name,
                        VersioningConfiguration: {
                            Status: 'Enabled',
                        },
                    })
                );
                console.log(`    → Enabled versioning on ${config.name}`);
            }

            // Configure lifecycle rules if enabled
            // Note: LocalStack has limited lifecycle support
            if (config.lifecycleRules) {
                try {
                    await s3Client.send(
                        new PutBucketLifecycleConfigurationCommand({
                            Bucket: config.name,
                            LifecycleConfiguration: {
                                Rules: [
                                    {
                                        ID: 'MoveToIA',
                                        Status: 'Enabled',
                                        Filter: { Prefix: '' },
                                        Transitions: [
                                            { Days: 30, StorageClass: 'STANDARD_IA' },
                                        ],
                                    },
                                    {
                                        ID: 'MoveToGlacier',
                                        Status: 'Enabled',
                                        Filter: { Prefix: '' },
                                        Transitions: [
                                            { Days: 365, StorageClass: 'GLACIER' },
                                        ],
                                    },
                                    {
                                        ID: 'DeleteAfter7Years',
                                        Status: 'Enabled',
                                        Filter: { Prefix: '' },
                                        Expiration: { Days: 2555 },
                                    },
                                ],
                            },
                        })
                    );
                    console.log(`    → Configured lifecycle rules on ${config.name}`);
                } catch {
                    console.log(`    ⚠ Lifecycle rules not supported (LocalStack limitation)`);
                }
            }
        } catch (error: any) {
            if (error.name === 'BucketAlreadyExists' || error.name === 'BucketAlreadyOwnedByYou') {
                console.log(`  ✓ Bucket ${config.name} already exists`);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Check if a log group exists
 */
async function logGroupExists(logGroupName: string): Promise<boolean> {
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
 * Create CloudWatch Log Groups
 */
async function createLogGroups(): Promise<void> {
    for (const [key, config] of Object.entries(CLOUDWATCH_LOG_GROUPS)) {
        if (await logGroupExists(config.name)) {
            console.log(`  ✓ Log group ${config.name} already exists`);
            continue;
        }

        try {
            await logsClient.send(
                new CreateLogGroupCommand({
                    logGroupName: config.name,
                })
            );
            console.log(`  → Created log group ${config.name}`);
        } catch (error: any) {
            if (error.name === 'ResourceAlreadyExistsException') {
                console.log(`  ✓ Log group ${config.name} already exists`);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Main bootstrap function
 */
export async function bootstrapLocalStack(): Promise<void> {
    console.log('==========================================');
    console.log('Pivotr Mailer - LocalStack Bootstrap');
    console.log('==========================================');
    console.log(`Endpoint: ${LOCALSTACK_ENDPOINT}`);
    console.log('');

    console.log('[1/6] Creating DynamoDB Tables...');
    for (const config of Object.values(DYNAMODB_TABLES)) {
        await createTable(config as typeof DYNAMODB_TABLES.leads);
    }

    console.log('');
    console.log('[2/6] Creating SQS Queues...');
    await createQueues();

    console.log('');
    console.log('[3/6] Creating SNS Topics...');
    await createTopics();

    console.log('');
    console.log('[4/6] Configuring SES...');
    await configureSES();

    console.log('');
    console.log('[5/6] Creating S3 Buckets...');
    await createBuckets();

    console.log('');
    console.log('[6/6] Creating CloudWatch Log Groups...');
    await createLogGroups();

    console.log('');
    console.log('==========================================');
    console.log('Bootstrap Complete!');
    console.log('==========================================');
}

/**
 * Export resource names for tests
 */
export const RESOURCE_NAMES = {
    tables: {
        leads: 'pivotr-leads',
        campaigns: 'pivotr-campaigns',
        metrics: 'pivotr-metrics',
        logs: 'pivotr-logs',
        settings: 'pivotr-settings',
    },
    queues: {
        sending: 'sending-queue',
        feedback: 'feedback-queue',
        verification: 'verification-queue',
        sendingDlq: 'sending-dlq',
        feedbackDlq: 'feedback-dlq',
        verificationDlq: 'verification-dlq',
    },
    topics: {
        alarms: 'pivotr-alarms',
        sesFeedback: 'pivotr-ses-feedback',
    },
    ses: {
        configurationSet: 'PivotrLocalConfigSet',
        verifiedEmails: ['noreply@pivotr.local', 'test@example.com'],
    },
    s3: {
        auditLogs: 'pivotr-audit-logs',
    },
    cloudwatch: {
        logGroups: {
            test: '/pivotr/test',
            sendEmail: '/aws/lambda/pivotr-send-email',
            processFeedback: '/aws/lambda/pivotr-process-feedback',
            verifyEmail: '/aws/lambda/pivotr-verify-email',
            leadImport: '/aws/lambda/pivotr-lead-import',
            apiLeads: '/aws/lambda/pivotr-api-leads',
            apiCampaigns: '/aws/lambda/pivotr-api-campaigns',
            apiMetrics: '/aws/lambda/pivotr-api-metrics',
        },
        metricsNamespace: 'PivotrMailer',
    },
};

// Run if executed directly
if (import.meta.main) {
    bootstrapLocalStack().catch((error) => {
        console.error('Bootstrap failed:', error);
        process.exit(1);
    });
}
