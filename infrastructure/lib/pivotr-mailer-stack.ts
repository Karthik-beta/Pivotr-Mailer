import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ses from 'aws-cdk-lib/aws-ses';
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
            },
            timeouts: {
                sendEmail: cdk.Duration.seconds(30),
                verifyEmail: cdk.Duration.seconds(15),
                processFeedback: cdk.Duration.seconds(10),
                leadImport: cdk.Duration.seconds(60),
                apiHandlers: cdk.Duration.seconds(10),
            },
            memory: {
                sendEmail: 256,
                verifyEmail: 256,
                processFeedback: 128,
                leadImport: 512,
                apiHandlers: 256,
            },
            sqsRetries: {
                sendingQueue: 3,
                feedbackQueue: 5,
                verificationQueue: 2,
            },
            // CloudWatch log retention to prevent infinite storage costs
            logRetention: logs.RetentionDays.ONE_MONTH,
        };

        // =====================================================
        // 1. DYNAMODB TABLES
        // =====================================================
        const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
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
            pointInTimeRecovery: true,
        });

        const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
            partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
        });

        const logsTable = new dynamodb.Table(this, 'LogsTable', {
            partitionKey: { name: 'campaignId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
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
            pointInTimeRecovery: true,
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
            LOG_LEVEL: 'INFO',
            ENVIRONMENT: 'production', // Should be dynamic based on stage
        };

        const processFeedbackLambda = new lambda.Function(this, 'ProcessFeedbackLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/process-feedback/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.processFeedback,
            memorySize: SAFETY.memory.processFeedback,
            reservedConcurrentExecutions: SAFETY.concurrency.processFeedback,
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });
        processFeedbackLambda.addEventSource(new SqsEventSource(feedbackQueue));

        const sendEmailLambda = new lambda.Function(this, 'SendEmailLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/send-email/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.sendEmail,
            memorySize: SAFETY.memory.sendEmail,
            reservedConcurrentExecutions: SAFETY.concurrency.sendEmail,
            logRetention: SAFETY.logRetention,
            environment: {
                ...commonEnv,
                SES_FROM_EMAIL: 'noreply@pivotr.com', // Replace with config
                SES_CONFIGURATION_SET: 'PivotrConfigSet',
            },
        });
        sendEmailLambda.addEventSource(new SqsEventSource(sendingQueue));

        const verifyEmailLambda = new lambda.Function(this, 'VerifyEmailLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/verify-email/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.verifyEmail,
            memorySize: SAFETY.memory.verifyEmail,
            reservedConcurrentExecutions: SAFETY.concurrency.verifyEmail,
            logRetention: SAFETY.logRetention,
            environment: {
                ...commonEnv,
                // MYEMAILVERIFIER_API_KEY: secret.secretValue, // Todo: Secrets Manager
            },
        });
        verifyEmailLambda.addEventSource(new SqsEventSource(verificationQueue));

        const leadImportLambda = new lambda.Function(this, 'LeadImportLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/lead-import/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.leadImport,
            memorySize: SAFETY.memory.leadImport,
            reservedConcurrentExecutions: SAFETY.concurrency.leadImport,
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });

        const apiLeadsLambda = new lambda.Function(this, 'ApiLeadsLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/leads/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers, // Shared if single API, but here separate
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });

        const apiCampaignsLambda = new lambda.Function(this, 'ApiCampaignsLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/campaigns/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers,
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });

        const apiMetricsLambda = new lambda.Function(this, 'ApiMetricsLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/metrics/dist')),
            handler: 'index.handler',
            timeout: SAFETY.timeouts.apiHandlers,
            memorySize: SAFETY.memory.apiHandlers,
            reservedConcurrentExecutions: SAFETY.concurrency.apiHandlers,
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });

        const apiLeadsExportLambda = new lambda.Function(this, 'ApiLeadsExportLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/api/leads-export/dist')),
            handler: 'index.handler',
            timeout: cdk.Duration.seconds(20), // Explicit 20s as per plan
            memorySize: 1024, // Explicit 1024MB for Excel ops
            reservedConcurrentExecutions: 5, // Abuse prevention
            logRetention: SAFETY.logRetention,
            environment: { ...commonEnv },
        });

        // =====================================================
        // 4. API GATEWAY
        // =====================================================
        const api = new apigateway.RestApi(this, 'PivotrMailerApi', {
            restApiName: 'Pivotr Mailer API',
            deployOptions: { stageName: 'v1' },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
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

        const campaign = campaigns.addResource('{id}');
        campaign.addMethod('GET', new apigateway.LambdaIntegration(apiCampaignsLambda));
        campaign.addMethod('PUT', new apigateway.LambdaIntegration(apiCampaignsLambda));
        campaign.addMethod('DELETE', new apigateway.LambdaIntegration(apiCampaignsLambda));

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

        // Grant SES permissions
        sendEmailLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ses:SendEmail', 'ses:SendRawEmail'],
            resources: ['*'], // Restrict to verified identities in prod
        }));

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
    }
}
