# Pivotr Mailer - Local Testing Guide

## Overview

This document describes the professional-grade local testing infrastructure for the Pivotr Mailer serverless application. The setup enables high-confidence testing before deploying to AWS, maintaining close parity with production behavior.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOCAL TESTING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐  │
│  │   Vitest    │    │   SAM CLI   │    │          LocalStack             │  │
│  │             │    │             │    │                                 │  │
│  │  Unit Tests │───▶│   Lambda    │───▶│  DynamoDB │ SQS │ SNS │ SES    │  │
│  │ Integration │    │   Runtime   │    │                                 │  │
│  │   Lambda    │    │   Docker    │    │         localhost:4566          │  │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘  │
│                                                                              │
│  Test Layers:                                                                │
│  ┌────────────┐ ┌────────────────┐ ┌───────────────┐ ┌────────────────────┐ │
│  │    Unit    │ │ Lambda Runtime │ │  Integration  │ │   Observability    │ │
│  │   (fast)   │ │    (SAM)       │ │  (LocalStack) │ │    (logging)       │ │
│  └────────────┘ └────────────────┘ └───────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before running tests, ensure you have:

1. **Docker Desktop** - Running and accessible
2. **AWS SAM CLI** - Installed globally (`sam --version`)
3. **Bun** - Package manager (`bun --version`)
4. **Node.js 20.x** - Runtime version matching Lambda

### Installation

```bash
# Install dependencies
bun install

# Verify SAM CLI
sam --version

# Verify Docker
docker info
```

## Quick Start

```bash
# 1. Start LocalStack
bun run localstack:up

# 2. Bootstrap AWS resources in LocalStack
bun run localstack:bootstrap

# 3. Run all tests
bun test

# 4. Run only unit tests (fastest)
bun run test:unit

# 5. Run integration tests (requires LocalStack)
bun run test:integration

# 6. Run Lambda runtime tests (requires SAM + Docker)
bun run test:lambda
```

## Test Layers

### 1. Unit Tests (`test:unit`)

**Purpose**: Validate pure business logic without AWS services.

**Characteristics**:
- No Docker required
- No network calls
- Executes in < 5 seconds
- Runs on every file save

**What to test**:
- Spintax resolution
- Variable injection
- Email validation
- Status transitions
- Data transformations

**Location**: `tests/unit/**/*.test.ts`

```bash
# Run unit tests
bun run test:unit

# Watch mode
bun run test:unit:watch
```

### 2. Integration Tests (`test:integration`)

**Purpose**: Validate Lambda handlers against real AWS services (LocalStack).

**Characteristics**:
- Requires Docker + LocalStack
- Uses real AWS SDK calls
- Tests DynamoDB, SQS, SNS, SES
- Isolated test data per test

**What to test**:
- DynamoDB CRUD operations
- SQS message publishing/consumption
- SNS notifications
- SES email sending (simulated)
- Cross-service workflows

**Location**: `tests/integration/**/*.test.ts`

```bash
# Ensure LocalStack is running
bun run localstack:up

# Run integration tests
bun run test:integration
```

### 3. Lambda Runtime Tests (`test:lambda`)

**Purpose**: Validate Lambda handlers in AWS-compatible runtime.

**Characteristics**:
- Uses SAM CLI + Docker
- Official AWS Lambda images
- High production fidelity
- Tests handler wiring + env vars

**What to test**:
- Handler invocation
- Environment variable injection
- Event payload parsing
- Error handling
- Batch processing

**Location**: `tests/lambda/**/*.test.ts`

```bash
# Build Lambda functions
bun run sam:build

# Run Lambda tests
bun run test:lambda
```

### 4. Observability Tests

**Purpose**: Validate logging formats and metrics payloads.

**Characteristics**:
- Unit-level speed
- No AWS dependencies
- Tests structured logging
- Validates metric formats

**Location**: `tests/unit/observability/**/*.test.ts`

## LocalStack Management

### Starting LocalStack

```bash
# Start in background
bun run localstack:up

# View logs
bun run localstack:logs

# Check health
bun run localstack:status
```

### Bootstrapping Resources

LocalStack starts empty. Bootstrap creates all required AWS resources:

```bash
bun run localstack:bootstrap
```

This creates:
- **DynamoDB Tables**: pivotr-leads, pivotr-campaigns, pivotr-metrics, pivotr-logs, pivotr-settings
- **SQS Queues**: sending-queue, feedback-queue, verification-queue + DLQs
- **SNS Topics**: pivotr-alarms, pivotr-ses-feedback
- **SES**: Verified email identities, configuration set
- **S3 Buckets**: pivotr-audit-logs (with versioning and lifecycle rules)
- **CloudWatch Log Groups**: Lambda function log groups and test log group

### Stopping LocalStack

```bash
# Stop and remove volumes
bun run localstack:down
```

## SAM CLI Usage

### Building Lambda Functions

```bash
# Full build
bun run sam:build

# Cached build (faster)
bun run sam:build:cached
```

### Local API Gateway

```bash
# Start local API
bun run sam:local:api

# API available at http://localhost:3000/v1
```

### Invoking Lambdas Directly

```bash
# Invoke with event file
sam local invoke SendEmailLambda --event tests/events/sqs-send-email.json

# Invoke via npm script
bun run sam:local:invoke -- SendEmailLambda --event tests/events/sqs-send-email.json
```

## Environment Configuration

### Test Environment Variables

All tests use `tests/.env.test`:

```bash
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
DYNAMODB_TABLE_LEADS=pivotr-leads
# ... etc
```

### SAM Local Environment

Lambda invocations use `tests/env/sam-local.json`:

```json
{
    "SendEmailLambda": {
        "AWS_ENDPOINT_URL": "http://host.docker.internal:4566",
        "DYNAMODB_TABLE_LEADS": "pivotr-leads"
    }
}
```

### Environment Safety

The test infrastructure **blocks production configuration**:

```bash
# Verify environment is safe
bun run test:env:check
```

Safety checks:
- `NODE_ENV` must be `test`
- `AWS_ENDPOINT_URL` must be localhost
- No real AWS credentials
- No production table names

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/shared/utils/spintax.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSpintax } from '@lambda/shared/src/utils/spintax';

describe('resolveSpintax', () => {
    it('should resolve simple spintax', () => {
        const result = resolveSpintax('{Hi|Hello} World');
        expect(result).toMatch(/^(Hi|Hello) World$/);
    });
});
```

### Integration Test Example

```typescript
// tests/integration/api/leads.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { insertLead, getLead, clearLeadsTable } from '../../utils/dynamodb-helpers';
import { createLead } from '../../utils/fixtures';

describe('Leads DynamoDB Integration', () => {
    beforeEach(async () => {
        await clearLeadsTable();
    });

    it('should insert and retrieve a lead', async () => {
        const lead = createLead({ fullName: 'Test User' });
        await insertLead(lead);

        const retrieved = await getLead(lead.id);
        expect(retrieved?.fullName).toBe('Test User');
    });
});
```

### Lambda Runtime Test Example

```typescript
// tests/lambda/send-email.test.ts
import { describe, it, expect } from 'vitest';
import { samLocalInvoke } from '../utils/sam-helpers';
import { createSQSEvent, createSQSRecord } from '../utils/fixtures';

describe('SendEmail Lambda', () => {
    it('should process SQS event', async () => {
        const event = createSQSEvent([
            createSQSRecord({ leadId: 'lead-123', campaignId: 'camp-456' })
        ]);

        const result = await samLocalInvoke({
            functionName: 'SendEmailLambda',
            event,
        });

        expect(result.exitCode).toBe(0);
    });
});
```

## Test Utilities

### Fixtures (`tests/utils/fixtures.ts`)

```typescript
import { createLead, createCampaign, createSQSEvent } from './utils/fixtures';

const lead = createLead({ status: 'QUEUED' });
const campaign = createCampaign({ name: 'Test Campaign' });
const event = createSQSEvent([createSQSRecord(message)]);
```

### DynamoDB Helpers (`tests/utils/dynamodb-helpers.ts`)

```typescript
import { insertLead, getLead, clearLeadsTable } from './utils/dynamodb-helpers';

await insertLead(lead);
const retrieved = await getLead(lead.id);
await clearLeadsTable();
```

### SQS Helpers (`tests/utils/sqs-helpers.ts`)

```typescript
import { sendToSendingQueue, receiveMessages, purgeAllQueues } from './utils/sqs-helpers';

await sendToSendingQueue(message);
const messages = await receiveMessages(queueUrl);
await purgeAllQueues();
```

### S3 Helpers (`tests/utils/s3-helpers.ts`)

```typescript
import {
    putObject,
    getObject,
    storeAuditLog,
    getAuditLogsForDate,
    createAuditLogEntry,
    clearAuditLogsBucket,
} from './utils/s3-helpers';

// Store audit log with automatic key generation
const entry = createAuditLogEntry({
    leadId: 'lead-123',
    campaignId: 'campaign-456',
    action: 'SEND',
    resolvedSubject: 'Hello John!',
});
const key = await storeAuditLog(entry);

// Retrieve logs for a date
const logs = await getAuditLogsForDate(new Date());

// Clean up
await clearAuditLogsBucket();
```

### CloudWatch Helpers (`tests/utils/cloudwatch-helpers.ts`)

```typescript
import {
    ensureLogGroupExists,
    createLogStream,
    putStructuredLogEvents,
    getStructuredLogEvents,
    putMetric,
    createStructuredLogEvent,
} from './utils/cloudwatch-helpers';

// Log group operations
await ensureLogGroupExists('/pivotr/test');
await createLogStream('/pivotr/test', 'my-stream');

// Structured logging
const events = [
    createStructuredLogEvent({
        level: 'INFO',
        message: 'Processing started',
        requestId: 'req-123',
    }),
];
await putStructuredLogEvents('/pivotr/test', 'my-stream', events);

// Metrics (limited in LocalStack)
await putMetric('EmailsSent', 1, {
    namespace: 'PivotrMailer',
    dimensions: { CampaignId: 'campaign-123' },
});
```

## S3 and CloudWatch Testing

### S3 Audit Logs

The S3 audit logs bucket stores compliance records for all emails sent:

```typescript
// tests/integration/s3/audit-logs.test.ts
import { storeAuditLog, getAuditLogsForCampaign } from '../../utils/s3-helpers';

it('should store email audit log', async () => {
    const entry = createAuditLogEntry({
        leadId: 'lead-123',
        email: 'test@example.com',
        action: 'SEND',
        resolvedSubject: 'Hello!',
        resolvedBody: '<p>Email content</p>',
    });

    const key = await storeAuditLog(entry);
    // Key format: 2024/01/15/campaign-id/lead-id-timestamp.json
});
```

**Audit Log Key Format:**
```
{year}/{month}/{day}/{campaignId}/{leadId}-{timestamp}.json
```

### CloudWatch Logs

Test structured logging for Lambda functions:

```typescript
// tests/integration/cloudwatch/logs.test.ts
it('should log structured events', async () => {
    const events = [
        createStructuredLogEvent({
            level: 'INFO',
            message: 'Email sent successfully',
            data: { leadId: 'lead-123', messageId: 'ses-456' },
        }),
    ];

    await putStructuredLogEvents(logGroup, logStream, events);
    const retrieved = await getStructuredLogEvents(logGroup, logStream);

    expect(retrieved[0].level).toBe('INFO');
});
```

### CloudWatch Metrics Limitations

**Important:** LocalStack has limited CloudWatch Metrics support:

- `PutMetricData` - **Works** - Publishing metrics succeeds
- `ListMetrics` - **Works** - Listing metrics succeeds
- `GetMetricStatistics` - **Limited** - May return empty results
- `PutMetricAlarm` - **Not Supported** - Alarms don't work locally

**Recommended Testing Approach:**

1. **Unit Tests**: Mock the CloudWatch client and verify correct data is passed
2. **Integration Tests**: Verify metric publishing doesn't throw errors
3. **E2E Tests**: Test against real AWS in staging for full validation

```typescript
// tests/integration/cloudwatch/metrics.test.ts
it('should publish campaign metrics', async () => {
    // This tests that publishing works, not that metrics are retrievable
    await expect(
        putMetric('EmailsSent', 100, {
            namespace: 'PivotrMailer',
            dimensions: { CampaignId: 'campaign-123' },
        })
    ).resolves.not.toThrow();
});
```

## CI Integration

### GitHub Actions Example

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      localstack:
        image: localstack/localstack:3.4
        ports:
          - 4566:4566
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run localstack:bootstrap
      - run: bun run test:integration

  lambda-tests:
    runs-on: ubuntu-latest
    services:
      localstack:
        image: localstack/localstack:3.4
        ports:
          - 4566:4566
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: aws-actions/setup-sam@v2
      - run: bun install
      - run: bun run localstack:bootstrap
      - run: bun run sam:build
      - run: bun run test:lambda
```

## Troubleshooting

### LocalStack Not Starting

```bash
# Check Docker is running
docker info

# Check LocalStack logs
docker logs pivotr-localstack

# Reset LocalStack
bun run localstack:down
bun run localstack:up
```

### SAM Build Failing

```bash
# Verify SAM installation
sam --version

# Build with verbose logging
sam build --debug

# Check Lambda function structure
ls -la lambda/send-email/dist/
```

### Tests Timing Out

```bash
# Increase timeout in vitest config
# testTimeout: 60000

# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

### Environment Safety Violations

```bash
# Check what's wrong
bun run test:env:check

# Common fixes:
export NODE_ENV=test
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
```

## Best Practices

1. **Run unit tests frequently** - On every save, before commits
2. **Use fixtures** - Create realistic test data with factory functions
3. **Clean up between tests** - Use `beforeEach` to clear tables/queues
4. **Test isolation** - Each test should be independent
5. **Mock external services** - Don't call real APIs in unit tests
6. **Use environment guards** - Never test against production
7. **Validate before deploy** - Run full suite before merging

## File Structure

```
tests/
├── config/
│   ├── test-config.ts         # Centralized config
│   └── environment-guard.ts   # Safety checks
├── setup/
│   ├── global.setup.ts        # All tests
│   ├── unit.setup.ts          # Unit tests only
│   ├── integration.setup.ts   # Integration tests
│   ├── lambda.setup.ts        # Lambda tests
│   └── localstack.global.ts   # Global LocalStack setup
├── utils/
│   ├── aws-clients.ts         # Pre-configured clients
│   ├── fixtures.ts            # Test data factories
│   ├── dynamodb-helpers.ts    # DynamoDB utilities
│   ├── sqs-helpers.ts         # SQS utilities
│   ├── s3-helpers.ts          # S3 utilities
│   ├── cloudwatch-helpers.ts  # CloudWatch utilities
│   └── sam-helpers.ts         # SAM CLI utilities
├── localstack/
│   ├── docker-compose.yml     # LocalStack config
│   ├── bootstrap.ts           # Resource creation
│   └── init-scripts/          # Auto-bootstrap
├── env/
│   └── sam-local.json         # SAM environment
├── unit/
│   ├── shared/
│   │   ├── utils/
│   │   └── validation/
│   ├── observability/
│   └── safety/
├── integration/
│   ├── api/
│   ├── dynamodb/
│   ├── sqs/
│   ├── s3/                    # S3 audit logs tests
│   ├── cloudwatch/            # CloudWatch Logs/Metrics tests
│   ├── lambda/
│   └── e2e/
├── lambda/
│   └── send-email.test.ts
└── .env.test                  # Test environment
```
