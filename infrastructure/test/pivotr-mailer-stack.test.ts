import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as PivotrMailer from '../lib/pivotr-mailer-stack';

test('Stack Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new PivotrMailer.PivotrMailerStack(app, 'MyTestStack');
  // THEN
  const template = Template.fromStack(stack);

  // Verify DynamoDB Tables
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    BillingMode: 'PAY_PER_REQUEST',
  });
  // 5 tables: Leads, Campaigns, Metrics, Logs, Settings
  template.resourceCountIs('AWS::DynamoDB::Table', 5);

  // Verify Queue creation
  // 3 main queues + 3 DLQs = 6
  template.resourceCountIs('AWS::SQS::Queue', 6);

  // Verify Lambda creation
  // ProcessFeedback, SendEmail, VerifyEmail, LeadImport, ApiLeads, ApiCampaigns, ApiMetrics, ApiLeadsExport = 8
  // Plus 1 CDK-generated LogRetention Lambda = 9
  template.resourceCountIs('AWS::Lambda::Function', 9);

  // Verify S3 Bucket
  template.resourceCountIs('AWS::S3::Bucket', 1);

  // Verify API Gateway
  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
});
