import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';

/**
 * Pivotr Mailer AWS Infrastructure Stack
 */
export class PivotrMailerStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // =====================================================
        // SAFETY CONSTANTS (PRD Section 5.3)
        // =====================================================
        const SAFETY = {
            concurrency: {
                sendEmail: 5,
                verifyEmail: 3,
                processFeedback: 10,
                leadImport: 2,
                apiHandlers: 10,
                campaignProcessor: 1, // Single instance to prevent race conditions
                bulkVerify: 5, // Parallel verification with rate limiting
            },
            timeouts: {
                sendEmail: cdk.Duration.seconds(30),
                verifyEmail: cdk.Duration.seconds(15),
                processFeedback: cdk.Duration.seconds(10),
                leadImport: cdk.Duration.seconds(60),
                apiHandlers: cdk.Duration.seconds(10),
                campaignProcessor: cdk.Duration.seconds(55), // Under 1-min cron
                bulkVerify: cdk.Duration.seconds(30),
            },
            memory: {
                sendEmail: 256,
                verifyEmail: 256,
                processFeedback: 128,
                leadImport: 512,
                apiHandlers: 256,
                campaignProcessor: 256,
                bulkVerify: 256,
            },
            sqsRetries: {
                sendingQueue: 3,
                feedbackQueue: 5,
                verificationQueue: 2,
            },
            // CloudWatch log retention for Lambda log groups
            logRetentionDays: logs.RetentionDays.ONE_MONTH,
        };

        // =====================================================
        // 1. DYNAMODB TABLES
        // =====================================================
        const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        });

        // GSIs for Leads
        leadsTable.addGlobalSecondaryIndex({
            indexName: 'EmailIndex',
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        leadsTable.addGlobalSecondaryIndex({
            indexName: 'StatusIndex',
            partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.INCLUDE,
            nonKeyAttributes: ['email', 'updatedAt'],
        });
        leadsTable.addGlobalSecondaryIndex({
            indexName: 'CampaignIndex',
            partitionKey: { name: 'campaignId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        const campaignsTable = new dynamodb.Table(this, 'CampaignsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        });

        const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        });

        const logsTable = new dynamodb.Table(this, 'LogsTable', {
            partitionKey: { name: 'campaignId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        });

        // GSI for Logs (Lead History)
        logsTable.addGlobalSecondaryIndex({
            indexName: 'LeadLogsIndex',
            partitionKey: { name: 'leadId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
        });

        const settingsTable = new dynamodb.Table(this, 'SettingsTable', {
            partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        });

        // =====================================================
        // 1.1 S3 BUCKET FOR AUDIT LOGS (Long-term Compliance Storage)
        // =====================================================
        const auditLogsBucket = new s3.Bucket(this, 'AuditLogsBucket', {
            bucketName: `pivotr-mailer-audit-logs-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true, // Protect against accidental overwrites
            enforceSSL: true,
            lifecycleRules: [
                {
                    // Move to Infrequent Access after 30 days (cheaper storage)
                    id: 'MoveToIA',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30),
                        },
                    ],
                },
                {
                    // Move to Glacier after 1 year (very cheap, compliance archive)
                    id: 'MoveToGlacier',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(365),
                        },
                    ],
                },
                {
                    // Delete after 7 years (adjust based on compliance requirements)
                    id: 'DeleteAfter7Years',
                    expiration: cdk.Duration.days(2555), // ~7 years
                },
            ],
        });

        // =====================================================
        // 2. SQS QUEUES
        // =====================================================
        // Dead Letter Queues
        const sendingDLQ = new sqs.Queue(this, 'SendingDLQ');
        const feedbackDLQ = new sqs.Queue(this, 'FeedbackDLQ');
        const verificationDLQ = new sqs.Queue(this, 'VerificationDLQ');

        // Main Queues
        const sendingQueue = new sqs.Queue(this, 'SendingQueue', {
            visibilityTimeout: SAFETY.timeouts.sendEmail.plus(cdk.Duration.seconds(5)),
            deadLetterQueue: {
                queue: sendingDLQ,
                maxReceiveCount: SAFETY.sqsRetries.sendingQueue,
            },
        });

        const feedbackQueue = new sqs.Queue(this, 'FeedbackQueue', {
            visibilityTimeout: SAFETY.timeouts.processFeedback.plus(cdk.Duration.seconds(5)),
            deadLetterQueue: {
                queue: feedbackDLQ,
                maxReceiveCount: SAFETY.sqsRetries.feedbackQueue,
            },
        });

        const verificationQueue = new sqs.Queue(this, 'VerificationQueue', {
            visibilityTimeout: SAFETY.timeouts.verifyEmail.plus(cdk.Duration.seconds(5)),
            deadLetterQueue: {
                queue: verificationDLQ,
                maxReceiveCount: SAFETY.sqsRetries.verificationQueue,
            },
        });

        // =====================================================
        // 2.1 SES -> SNS -> SQS PIPELINE (Email Feedback)
        // =====================================================
        // SNS Topic for SES feedback (bounces, complaints, deliveries)
        const sesFeedbackTopic = new sns.Topic(this, 'SESFeedbackTopic', {
            topicName: 'pivotr-ses-feedback',
            displayName: 'SES Email Feedback Notifications',
        });

        // Subscribe the FeedbackQueue to the SES Feedback SNS Topic
        sesFeedbackTopic.addSubscription(new subs.SqsSubscription(feedbackQueue, {
            rawMessageDelivery: true, // Deliver raw SES notification JSON
        }));

        // SES Configuration Set for tracking email events
        const sesConfigSet = new ses.ConfigurationSet(this, 'PivotrConfigSet', {
            configurationSetName: 'PivotrConfigSet',
            reputationMetrics: true,
            sendingEnabled: true,
        });

        // Event destination: Send bounce/complaint/delivery events to SNS
        new ses.ConfigurationSetEventDestination(this, 'SESEventDestination', {
            configurationSet: sesConfigSet,
            configurationSetEventDestinationName: 'FeedbackToSNS',
            destination: ses.EventDestination.snsTopic(sesFeedbackTopic),
            events: [
                ses.EmailSendingEvent.BOUNCE,
                ses.EmailSendingEvent.COMPLAINT,
                ses.EmailSendingEvent.DELIVERY,
                ses.EmailSendingEvent.REJECT,
            ],
        });

        // =====================================================
        // 3. LAMBDA FUNCTIONS
        // =====================================================
        const commonEnv = {
            DYNAMODB_TABLE_LEADS: leadsTable.tableName,
            DYNAMODB_TABLE_CAMPAIGNS: campaignsTable.tableName,
            DYNAMODB_TABLE_METRICS: metricsTable.tableName,
            DYNAMODB_TABLE_LOGS: logsTable.tableName,
            S3_AUDIT_LOGS_BUCKET: auditLogsBucket.bucketName,
            LOG_LEVEL: 'INFO',
            ENVIRONMENT: 'production', // Should be dynamic based on stage
        };

        // =====================================================
        // 3.1 LOG GROUPS (Replaces deprecated logRetention property)
        // =====================================================
        // Create explicit LogGroups for each Lambda function
        // This follows AWS CDK best practice for managing log retention

        const processFeedbackLogGroup = new logs.LogGroup(this, 'ProcessFeedbackLogGroup', {
            logGroupName: '/aws/lambda/pivotr-process-feedback',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const sendEmailLogGroup = new logs.LogGroup(this, 'SendEmailLogGroup', {
            logGroupName: '/aws/lambda/pivotr-send-email',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const verifyEmailLogGroup = new logs.LogGroup(this, 'VerifyEmailLogGroup', {
            logGroupName: '/aws/lambda/pivotr-verify-email',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const leadImportLogGroup = new logs.LogGroup(this, 'LeadImportLogGroup', {
            logGroupName: '/aws/lambda/pivotr-lead-import',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const apiLeadsLogGroup = new logs.LogGroup(this, 'ApiLeadsLogGroup', {
            logGroupName: '/aws/lambda/pivotr-api-leads',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const apiCampaignsLogGroup = new logs.LogGroup(this, 'ApiCampaignsLogGroup', {
            logGroupName: '/aws/lambda/pivotr-api-campaigns',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const apiMetricsLogGroup = new logs.LogGroup(this, 'ApiMetricsLogGroup', {
            logGroupName: '/aws/lambda/pivotr-api-metrics',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const apiLeadsExportLogGroup = new logs.LogGroup(this, 'ApiLeadsExportLogGroup', {
            logGroupName: '/aws/lambda/pivotr-api-leads-export',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const campaignProcessorLogGroup = new logs.LogGroup(this, 'CampaignProcessorLogGroup', {
            logGroupName: '/aws/lambda/pivotr-campaign-processor',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const bulkVerifyLogGroup = new logs.LogGroup(this, 'BulkVerifyLogGroup', {
            logGroupName: '/aws/lambda/pivotr-bulk-verify',
            retention: SAFETY.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        // =====================================================
        // 3.2 LAMBDA FUNCTION DEFINITIONS
        // =====================================================

        const processFeedbackLambda = new lambda.Function(this, 'ProcessFeedbackLambda', {
            functionName: 'pivotr-process-feedback',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/process-feedback/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.processFeedback,
            memorySize: SAFETY.memory.processFeedback,
            reservedConcurrentExecutions: SAFETY.concurrency.processFeedback,
            logGroup: processFeedbackLogGroup,
            environment: { ...commonEnv },
        });
        processFeedbackLambda.addEventSource(new SqsEventSource(feedbackQueue, {
            reportBatchItemFailures: true,
        }));

        const sendEmailLambda = new lambda.Function(this, 'SendEmailLambda', {
            functionName: 'pivotr-send-email',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/send-email/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.sendEmail,
            memorySize: SAFETY.memory.sendEmail,
            reservedConcurrentExecutions: SAFETY.concurrency.sendEmail,
            logGroup: sendEmailLogGroup,
            environment: {
                ...commonEnv,
                SES_FROM_EMAIL: 'noreply@pivotr.com', // Replace with config
                SES_CONFIGURATION_SET: 'PivotrConfigSet',
            },
        });
        sendEmailLambda.addEventSource(new SqsEventSource(sendingQueue, {
            reportBatchItemFailures: true,
        }));

        const verifyEmailLambda = new lambda.Function(this, 'VerifyEmailLambda', {
            functionName: 'pivotr-verify-email',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/verify-email/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.verifyEmail,
            memorySize: SAFETY.memory.verifyEmail,
            reservedConcurrentExecutions: SAFETY.concurrency.verifyEmail,
            logGroup: verifyEmailLogGroup,
            environment: {
                ...commonEnv,
                // MYEMAILVERIFIER_API_KEY: secret.secretValue, // Todo: Secrets Manager
            },
        });
        verifyEmailLambda.addEventSource(new SqsEventSource(verificationQueue, {
            reportBatchItemFailures: true,
        }));

        const leadImportLambda = new lambda.Function(this, 'LeadImportLambda', {
            functionName: 'pivotr-lead-import',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/lead-import/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.leadImport,
            memorySize: SAFETY.memory.leadImport,
            reservedConcurrentExecutions: SAFETY.concurrency.leadImport,
            logGroup: leadImportLogGroup,
            environment: { ...commonEnv },
        });

        const apiLeadsLambda = new lambda.Function(this, 'ApiLeadsLambda', {
            functionName: 'pivotr-api-leads',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/leads/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers,
            logGroup: apiLeadsLogGroup,
            environment: { ...commonEnv },
        });

        const apiCampaignsLambda = new lambda.Function(this, 'ApiCampaignsLambda', {
            functionName: 'pivotr-api-campaigns',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/campaigns/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers,
            logGroup: apiCampaignsLogGroup,
            environment: {
                ...commonEnv,
                SQS_VERIFICATION_QUEUE_URL: verificationQueue.queueUrl,
                SES_FROM_EMAIL: 'noreply@pivotr.com', // Replace with config
                SES_CONFIGURATION_SET: 'PivotrConfigSet',
            },
        });

        const apiMetricsLambda = new lambda.Function(this, 'ApiMetricsLambda', {
            functionName: 'pivotr-api-metrics',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/metrics/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers,
            logGroup: apiMetricsLogGroup,
            environment: { ...commonEnv },
        });

        const apiLeadsExportLambda = new lambda.Function(this, 'ApiLeadsExportLambda', {
            functionName: 'pivotr-api-leads-export',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/leads-export/dist')),
            handler: 'index.handler',
            timeout: cdk.Duration.seconds(20), // Explicit 20s as per plan
            memorySize: 1024, // Explicit 1024MB for Excel ops
            reservedConcurrentExecutions: 5, // Abuse prevention
            logGroup: apiLeadsExportLogGroup,
            environment: { ...commonEnv },
        });

        // Campaign Processor Lambda (Orchestrator with Gaussian timing)
        const campaignProcessorLambda = new lambda.Function(this, 'CampaignProcessorLambda', {
            functionName: 'pivotr-campaign-processor',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/campaign-processor/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.campaignProcessor,
            memorySize: SAFETY.memory.campaignProcessor,
            reservedConcurrentExecutions: SAFETY.concurrency.campaignProcessor,
            logGroup: campaignProcessorLogGroup,
            environment: {
                ...commonEnv,
                SQS_VERIFICATION_QUEUE_URL: verificationQueue.queueUrl,
                SQS_SENDING_QUEUE_URL: sendingQueue.queueUrl,
            },
        });

        // EventBridge rule: trigger every minute for Gaussian timing precision
        const campaignProcessorRule = new events.Rule(this, 'CampaignProcessorSchedule', {
            ruleName: 'pivotr-campaign-processor-schedule',
            schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
            description: 'Triggers campaign processor every minute for Gaussian email scheduling',
        });
        campaignProcessorRule.addTarget(new targets.LambdaFunction(campaignProcessorLambda));

        // Bulk Verify Lambda (Email, Name, Company verification)
        const bulkVerifyLambda = new lambda.Function(this, 'BulkVerifyLambda', {
            functionName: 'pivotr-bulk-verify',
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/bulk-verify/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.bulkVerify,
            memorySize: SAFETY.memory.bulkVerify,
            reservedConcurrentExecutions: SAFETY.concurrency.bulkVerify,
            logGroup: bulkVerifyLogGroup,
            environment: {
                ...commonEnv,
                SQS_SENDING_QUEUE_URL: sendingQueue.queueUrl,
                // MYEMAILVERIFIER_API_KEY: from Secrets Manager
            },
        });
        bulkVerifyLambda.addEventSource(new SqsEventSource(verificationQueue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
        }));

        // =====================================================
        // 4. API GATEWAY
        // =====================================================
        // Context or Default CORS
        const corsAllowedOrigins = this.node.tryGetContext('corsAllowedOrigins') || ['http://localhost:5173', 'http://localhost:3000'];

        const api = new apigateway.RestApi(this, 'PivotrMailerApi', {
            restApiName: 'Pivotr Mailer API',
            deployOptions: { stageName: 'v1' },
            defaultCorsPreflightOptions: {
                allowOrigins: corsAllowedOrigins,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        const leads = api.root.addResource('leads');
        leads.addMethod('GET', new apigateway.LambdaIntegration(apiLeadsLambda));
        leads.addMethod('POST', new apigateway.LambdaIntegration(apiLeadsLambda));

        // Export & Template Routes
        const exportRes = leads.addResource('export');
        exportRes.addMethod('POST', new apigateway.LambdaIntegration(apiLeadsExportLambda));

        const templateRes = leads.addResource('template');
        templateRes.addMethod('GET', new apigateway.LambdaIntegration(apiLeadsExportLambda));

        const lead = leads.addResource('{id}');
        lead.addMethod('GET', new apigateway.LambdaIntegration(apiLeadsLambda));
        lead.addMethod('PUT', new apigateway.LambdaIntegration(apiLeadsLambda));
        lead.addMethod('DELETE', new apigateway.LambdaIntegration(apiLeadsLambda));

        const importRes = leads.addResource('import');
        importRes.addMethod('POST', new apigateway.LambdaIntegration(leadImportLambda));

        const campaigns = api.root.addResource('campaigns');
        campaigns.addMethod('GET', new apigateway.LambdaIntegration(apiCampaignsLambda));
        campaigns.addMethod('POST', new apigateway.LambdaIntegration(apiCampaignsLambda));

        // Preview leads endpoint (before creating campaign)
        const previewLeads = campaigns.addResource('preview-leads');
        previewLeads.addMethod('POST', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const campaign = campaigns.addResource('{id}');
        campaign.addMethod('GET', new apigateway.LambdaIntegration(apiCampaignsLambda));
        campaign.addMethod('PUT', new apigateway.LambdaIntegration(apiCampaignsLambda));
        campaign.addMethod('DELETE', new apigateway.LambdaIntegration(apiCampaignsLambda));

        // Campaign sub-resources
        const campaignLeads = campaign.addResource('leads');
        campaignLeads.addMethod('GET', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const assignLeads = campaign.addResource('assign-leads');
        assignLeads.addMethod('POST', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const campaignStatus = campaign.addResource('status');
        campaignStatus.addMethod('PUT', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const testEmail = campaign.addResource('test-email');
        testEmail.addMethod('POST', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const campaignMetrics = campaign.addResource('metrics');
        campaignMetrics.addMethod('GET', new apigateway.LambdaIntegration(apiCampaignsLambda));

        const verifyLeads = campaign.addResource('verify');
        verifyLeads.addMethod('POST', new apigateway.LambdaIntegration(bulkVerifyLambda));

        const metrics = api.root.addResource('metrics');
        metrics.addMethod('GET', new apigateway.LambdaIntegration(apiMetricsLambda));

        // =====================================================
        // 5. PERMISSIONS
        // =====================================================
        leadsTable.grantReadWriteData(leadImportLambda);
        leadsTable.grantReadWriteData(apiLeadsLambda);
        leadsTable.grantReadWriteData(sendEmailLambda);
        leadsTable.grantReadWriteData(verifyEmailLambda);
        leadsTable.grantReadWriteData(processFeedbackLambda);
        leadsTable.grantReadData(apiLeadsExportLambda);

        campaignsTable.grantReadWriteData(apiCampaignsLambda);
        campaignsTable.grantReadData(sendEmailLambda); // campaign details

        metricsTable.grantReadData(apiMetricsLambda);
        metricsTable.grantReadWriteData(processFeedbackLambda);
        metricsTable.grantReadWriteData(sendEmailLambda); // daily cap check & increment
        metricsTable.grantReadWriteData(campaignProcessorLambda); // campaign metrics
        metricsTable.grantReadWriteData(bulkVerifyLambda); // verification metrics

        // Campaign Processor permissions
        campaignsTable.grantReadWriteData(campaignProcessorLambda);
        leadsTable.grantReadWriteData(campaignProcessorLambda);
        sendingQueue.grantSendMessages(campaignProcessorLambda);
        verificationQueue.grantSendMessages(campaignProcessorLambda);

        // Bulk Verify permissions
        leadsTable.grantReadWriteData(bulkVerifyLambda);
        sendingQueue.grantSendMessages(bulkVerifyLambda);

        // API Campaigns needs SES for test emails and SQS for bulk verification
        apiCampaignsLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: [
                `arn:aws:ses:${this.region}:${this.account}:identity/*`,
                `arn:aws:ses:${this.region}:${this.account}:configuration-set/PivotrConfigSet`
            ],
        }));
        leadsTable.grantReadWriteData(apiCampaignsLambda);
        verificationQueue.grantSendMessages(apiCampaignsLambda);

        // Grant SES permissions (Scoped)
        sendEmailLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: [
                `arn:aws:ses:${this.region}:${this.account}:identity/*`,
                `arn:aws:ses:${this.region}:${this.account}:configuration-set/PivotrConfigSet`
            ],
        }));

        // Grant S3 audit log write permissions to all Lambdas that generate logs
        auditLogsBucket.grantWrite(sendEmailLambda);
        auditLogsBucket.grantWrite(verifyEmailLambda);
        auditLogsBucket.grantWrite(processFeedbackLambda);
        auditLogsBucket.grantWrite(leadImportLambda);
        auditLogsBucket.grantRead(apiLeadsLambda); // For audit trail queries

        // =====================================================
        // 6. MONITORING & ALARMS (PRD Section 5.3.7)
        // =====================================================
        const alarmTopic = new sns.Topic(this, 'AlarmTopic');
        // Add email subscription manually or via props if email provided

        // 6.1 Lambda Alarms
        const lambdas = [
            { id: 'SendEmail', fn: sendEmailLambda },
            { id: 'VerifyEmail', fn: verifyEmailLambda },
            { id: 'ProcessFeedback', fn: processFeedbackLambda },
            { id: 'CampaignProcessor', fn: campaignProcessorLambda },
            { id: 'BulkVerify', fn: bulkVerifyLambda },
        ];

        lambdas.forEach(({ id, fn }) => {
            new cloudwatch.Alarm(this, `${id}ErrorsAlarm`, {
                metric: fn.metricErrors({ period: cdk.Duration.minutes(5) }),
                threshold: 10,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            }).addAlarmAction(new cw_actions.SnsAction(alarmTopic));
        });

        // 6.2 Queue Alarms (DLQ Depth)
        const dlqs = [
            { id: 'Sending', queue: sendingDLQ },
            { id: 'Feedback', queue: feedbackDLQ },
            { id: 'Verification', queue: verificationDLQ },
        ];

        dlqs.forEach(({ id, queue }) => {
            new cloudwatch.Alarm(this, `${id}DLQDepthAlarm`, {
                metric: queue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            }).addAlarmAction(new cw_actions.SnsAction(alarmTopic));
        });

        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
        new cdk.CfnOutput(this, 'AlarmTopicArn', { value: alarmTopic.topicArn });
        new cdk.CfnOutput(this, 'SESFeedbackTopicArn', { value: sesFeedbackTopic.topicArn });
        new cdk.CfnOutput(this, 'SESConfigSetName', { value: sesConfigSet.configurationSetName });
        new cdk.CfnOutput(this, 'AuditLogsBucketName', { value: auditLogsBucket.bucketName });
        new cdk.CfnOutput(this, 'AuditLogsBucketArn', { value: auditLogsBucket.bucketArn });
    }
}
