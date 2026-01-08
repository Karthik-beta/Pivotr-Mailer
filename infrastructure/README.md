# AWS Infrastructure (CDK)

This directory contains AWS Cloud Development Kit (CDK) infrastructure-as-code for the Pivotr Mailer backend.

## Overview

The infrastructure is defined using **AWS CDK v2** with TypeScript, following AWS best practices.

## Stack Structure

```
infrastructure/
├── bin/
│   └── pivotr-mailer.ts     # CDK app entry point
├── lib/
│   ├── pivotr-mailer-stack.ts   # Main stack definition
│   ├── constructs/
│   │   ├── lambda-functions.ts  # Lambda function definitions
│   │   ├── dynamodb-tables.ts   # DynamoDB table definitions
│   │   ├── sqs-queues.ts        # SQS queue definitions
│   │   ├── ses-config.ts        # SES configuration
│   │   ├── api-gateway.ts       # API Gateway setup
│   │   └── monitoring.ts        # CloudWatch alarms & dashboards
│   └── config/
│       ├── lambda-config.ts     # Lambda concurrency, timeout, memory
│       └── budget-config.ts     # AWS Budgets configuration
├── test/
│   └── pivotr-mailer.test.ts
├── cdk.json
├── package.json
└── tsconfig.json
```

## Safety Requirements (MANDATORY)

Per PRD Section 5.3, all resources MUST include:

### 1. Lambda Functions
- `reservedConcurrentExecutions` - Explicit concurrency limit
- `timeout` - Explicit timeout (not default)
- `memorySize` - Right-sized memory
- `deadLetterQueue` - DLQ for async invocations

### 2. SQS Queues
- `deadLetterQueue` with `maxReceiveCount` <= 5
- Visibility timeout aligned with Lambda timeout

### 3. DynamoDB Tables
- `removalPolicy: RemovalPolicy.RETAIN` for production
- `deletionProtection: true`
- Point-in-time recovery enabled

### 4. All Resources
- Tags: `Project`, `Environment`, `CostCenter`

## Deployment Commands

```bash
# Install dependencies
npm install

# Synthesize CloudFormation template
cdk synth

# Deploy to AWS
cdk deploy

# Deploy with approval for security changes
cdk deploy --require-approval broadening

# Destroy stack (CAUTION)
cdk destroy
```

## Environment Configuration

Create a `.env` file or use AWS SSM Parameter Store:

```
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-south-1
ENVIRONMENT=production
```

## Cost Safety

Before first deployment:
1. Configure AWS Budgets (see PRD Section 5.3.2)
2. Enable Cost Anomaly Detection
3. Verify all Lambda functions have concurrency limits

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
