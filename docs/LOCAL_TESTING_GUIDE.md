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
# Start local API (with watch mode enabled in samconfig.toml)
bun run sam:local:api

# Watch mode automatically monitors for file changes and rebuilds Lambda containers
# API available at http://localhost:3000/v1

# To disable watch mode temporarily, run:
sam local start-api --no-watch
```

### Invoking Lambdas Directly

```bash
# Invoke with event file
sam local invoke SendEmailLambda --event tests/events/sqs-send-email.json

# Invoke via npm script
bun run sam:local:invoke -- SendEmailLambda --event tests/events/sqs-send-email.json
```

## SAM Accelerate for Rapid Development

### What is SAM Accelerate?

SAM Accelerate is a feature of AWS SAM CLI that speeds up development by synchronizing local code changes directly to AWS CloudFormation deployments in real-time. Instead of running full deployments for every change, `sam sync` watches your code and updates only what changed.

**Key Benefits:**
- **Fast Iterations**: Code changes deploy in seconds, not minutes
- **Real Cloud Testing**: Test against actual AWS services (not emulators)
- **CORS Fidelity**: API Gateway CORS behavior matches production exactly

### Why SAM Accelerate Over SAM Local for CORS Testing?

SAM Local (`sam local start-api`) has limitations when testing CORS:

| Feature | SAM Local | SAM Accelerate |
|---------|-----------|----------------|
| CORS Headers | Emulated (may differ from production) | Real API Gateway behavior |
| Preflight Requests | Limited support | Full OPTIONS handling |
| Authorizers | Mocked | Real Lambda authorizers |
| Latency | Instant (local) | Real network latency |

**Recommendation**: Use SAM Accelerate when testing features that depend on API Gateway behavior (CORS, authentication, request/response transformations).

### Using `sam sync --watch`

#### Prerequisites

1. An AWS account with a development environment
2. SAM CLI installed and configured
3. Appropriate IAM permissions for deployment

#### Basic Commands

```bash
# Initial sync and start watching for changes
sam sync --watch --stack-name pivotr-mailer-dev

# Sync only infrastructure (CloudFormation template changes)
sam sync --watch --stack-name pivotr-mailer-dev --resource-id MyApi

# Sync only a specific Lambda function
sam sync --watch --stack-name pivotr-mailer-dev --resource-id SendEmailLambda

# Dry run to see what would be synced
sam sync --dryrun --stack-name pivotr-mailer-dev
```

#### Typical Development Workflow

```bash
# 1. Start SAM Accelerate in one terminal
sam sync --watch --stack-name pivotr-mailer-dev

# 2. Make code changes in your editor
#    SAM automatically detects and syncs changes

# 3. Test against real AWS endpoints
curl https://xxxxxx.execute-api.us-east-1.amazonaws.com/v1/leads

# 4. Check CloudWatch logs for Lambda output
aws logs tail /aws/lambda/pivotr-mailer-dev-SendEmailLambda --follow
```

#### Code Change Detection

SAM Accelerate automatically detects:

| Change Type | Sync Speed | Action |
|-------------|------------|--------|
| Lambda code (Node.js/Python) | ~2-5 seconds | Direct update to Lambda |
| Infrastructure (template.yaml) | ~30-60 seconds | CloudFormation deployment |
| Layer changes | ~10-20 seconds | Layer update + function refresh |

#### Stopping SAM Accelerate

Press `Ctrl+C` to stop watching. Your deployed resources remain in AWS until you delete the stack.

### Cost Considerations

SAM Accelerate deploys to real AWS resources. To minimize costs:

1. **Use a dedicated dev stack** - Isolate from production
2. **Right-size Lambda memory** - Use 128MB for dev unless testing performance
3. **Set up AWS Budgets** - Alert at 50%, 80%, 100% of budget
4. **Clean up after development** - Delete stacks when not in use

```bash
# Delete development stack when done
sam delete --stack-name pivotr-mailer-dev
```

### Comparison: Local Testing vs SAM Accelerate

| Scenario | Recommended Approach |
|----------|---------------------|
| Unit tests (business logic) | Vitest + mocks |
| Integration tests (AWS SDK) | LocalStack |
| CORS/API Gateway testing | SAM Accelerate |
| Authorizer testing | SAM Accelerate |
| Quick iteration on Lambda code | SAM Accelerate |
| CI/CD pipeline | Full `sam deploy` |

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

## Watch Mode Optimization

### Overview

The SAM CLI watch mode (`sam local start-api --watch`) automatically monitors your Lambda function code for changes and rebuilds containers on-the-fly. To maximize development productivity, follow these optimization best practices.

### Watch Exclusion File

SAM CLI supports excluding files from watch detection to improve performance. The configuration file [`.aws-sam/watch-exclude.txt`](.aws-sam/watch-exclude.txt) contains patterns that are ignored during file change detection.

```bash
# Example patterns in .aws-sam/watch-exclude.txt
tests/**
*.test.ts
*.spec.ts
**/.aws-sam/**
**/node_modules/**
**/dist/**
**/*.md
**/.git/**
.env*
coverage/**
```

**Why exclude these patterns?**
- **Test files**: Changes to test files don't require Lambda rebuilds
- **Build artifacts**: `dist/` and `.aws-sam/` are generated, not source
- **Documentation**: `.md` files don't affect runtime behavior
- **Environment files**: `.env*` should not trigger rebuilds locally
- **Coverage**: `coverage/` is generated output

### Performance Tips

#### 1. Use Cached Builds

Always enable caching for faster rebuilds:

```toml
# samconfig.toml
[default.build.parameters]
cached = true
parallel = true
use_container = false
```

```bash
# Build with cache
sam build --cached

# Or use cached build via bun script
bun run sam:build:cached
```

#### 2. Parallel Builds

Enable parallel compilation for multi-function projects:

```bash
sam build --parallel
```

#### 3. Minimize Container Restarts

- **Keep Lambda warm**: Use `warm_containers = "EAGER"` in samconfig.toml
- **Skip image pulls**: Use `skip_pull_image = true` after initial run
- **Use host networking**: Configure `docker_network` to avoid network overhead

```toml
[default.local_start_api.parameters]
warm_containers = "EAGER"
skip_pull_image = true
docker_network = "pivotr-localstack-network"
```

#### 4. Optimize File Watching

- **Exclude non-essential files**: Ensure `watch_exclude_file` is configured
- **Use targeted invocations**: For single function testing, use `sam local invoke` instead of `start-api`
- **Limit watch scope**: If possible, work in a single function directory

#### 5. Development Workflow

```bash
# Terminal 1: Start LocalStack (background)
bun run localstack:up

# Terminal 2: Start watch mode
sam local start-api --watch

# Terminal 3: Run unit tests (fast feedback)
bun run test:unit:watch
```

### Environment Configurations

The [`samconfig.toml`](samconfig.toml) file supports multiple environments:

| Environment | Use Case | Build Settings |
|-------------|----------|----------------|
| `default` | General development | Cached, parallel |
| `local` | Local watch mode | Cached, parallel, watch enabled |
| `dev` | AWS dev deployments | Cached, parallel |
| `prod` | AWS prod deployments | No cache, parallel |

#### Using Environment-Specific Configurations

```bash
# Use default environment
sam build
sam local start-api

# Use local environment (with explicit watch)
sam local start-api --config-env local

# Use dev environment for AWS deployment
sam deploy --config-env dev

# Use prod environment for AWS deployment
sam deploy --config-env prod
```

### Troubleshooting Watch Mode

#### Slow Rebuilds

1. Check exclusion file is being read
2. Reduce number of files in project root
3. Ensure `node_modules` and `dist` are excluded
4. Consider using `sam local invoke` for single-function testing

#### Container Creation Failures

```bash
# Rebuild from scratch
sam build --force

# Clear SAM cache
rm -rf .aws-sam/build
rm -rf .aws-sam/cache
```

#### File Changes Not Detected

```bash
# Verify watch is enabled
sam local start-api --debug

# Check exclusion patterns
cat .aws-sam/watch-exclude.txt
```

## Complete Development Workflow

### Initial Setup

Before starting development, ensure all prerequisites are met and resources are initialized:

```bash
# 1. Install dependencies
bun install

# 2. Verify SAM CLI installation
sam --version

# 3. Verify Docker is running
docker info

# 4. Start LocalStack (background)
bun run localstack:up

# 5. Wait for LocalStack to be ready (30-60 seconds)
bun run localstack:status

# 6. Bootstrap AWS resources in LocalStack
bun run localstack:bootstrap

# 7. Build all Lambda functions
bun run sam:build

# 8. Verify build succeeded
ls .aws-sam/build/
```

### Daily Development Workflow

For optimal development velocity, use separate terminals for different services:

#### Terminal 1: LocalStack (Infrastructure)

```bash
# Start LocalStack and keep running
bun run localstack:up

# Optional: View LocalStack logs
bun run localstack:logs
```

#### Terminal 2: SAM Local API (Backend)

```bash
# Start local API with watch mode
bun run sam:local:api

# API available at http://localhost:3000/v1
# Watch mode automatically rebuilds on file changes
```

#### Terminal 3: Unit Tests (Fast Feedback)

```bash
# Run unit tests in watch mode
bun run test:unit:watch

# Provides instant feedback on business logic changes
```

#### Terminal 4: Frontend Development (Optional)

```bash
# Start frontend development server
cd frontend && bun dev

# Frontend can proxy API calls to SAM local
```

### Rebuild Triggers and Expected Times

The following table shows what changes trigger rebuilds and the expected rebuild times:

| Change Type | Triggers Rebuild | Expected Time | Notes |
|-------------|------------------|---------------|-------|
| Lambda function code (`lambda/*/src/**/*.ts`) | Function only | 2-5 seconds | esbuild with caching |
| Shared utilities (`lambda/shared/src/**/*.ts`) | Layer + All functions | 10-20 seconds | Layer rebuild propagates to all functions |
| SAM template (`template.yaml`) | All resources | 30-60 seconds | Full stack rebuild |
| Package dependencies (`package.json`) | Affected functions | 5-15 seconds | Only if `bun.lock` changes |
| Test files (`tests/**/*.ts`) | No rebuild | N/A | Excluded via `watch-exclude.txt` |
| Generated files (`lambda/*/dist/**`) | No rebuild | N/A | Excluded via `watch-exclude.txt` |
| Documentation (`**/*.md`) | No rebuild | N/A | Excluded via `watch-exclude.txt` |

### Layer Rebuild Behavior

The SharedUtilsLayer is a special resource that all Lambda functions depend on:

```
lambda/shared/src/
├── clients/      # DynamoDB, SQS, SES clients
├── config/       # Environment configuration
├── errors/       # Custom error classes
├── logger/       # Structured logging utilities
└── utils/        # Common utilities
```

**When the layer changes:**
1. SAM detects changes in `lambda/shared/`
2. Layer is rebuilt with esbuild
3. All functions referencing the layer are refreshed
4. New container images are created on next invocation

**Important:** The `watch-exclude.txt` is configured to NOT exclude `lambda/shared/src/**`, ensuring layer changes trigger rebuilds.

### Email Application Hot Reload Workflow

When developing email-related features in Pivotr Mailer, hot reload enables rapid iteration on email templates, spintax variations, and personalization logic.

#### Testing Email Changes Quickly

The email sending pipeline involves multiple components that can be tested locally:

```
Email Template Change Flow:
1. Modify template in campaign or email body
2. SAM detects change in lambda/send-email/src/
3. Function rebuilds (2-5 seconds with cache)
4. New container created on next API call
5. Test email sent via LocalStack SES
```

#### Spintax Hot Reload Example

Spintax is a key feature for email variation. Here's how to test spintax changes rapidly:

1. **Start the development environment:**

```bash
# Terminal 1: LocalStack
bun run localstack:up

# Terminal 2: SAM API with watch
bun run sam:local:api

# Terminal 3: Unit tests (spintax tests)
bun run test:unit:watch --filter spintax
```

2. **Modify spintax logic in `lambda/shared/src/utils/spintax.ts`:**

```typescript
// Example: Add new spintax pattern support
// Changes are automatically picked up by watch mode
```

3. **Test the change immediately:**

```bash
# Unit tests auto-run in Terminal 3
# Or manually test via API:
curl -X POST http://localhost:3000/v1/campaigns/test-email \
  -H "Content-Type: application/json" \
  -d '{"recipientEmail": "test@example.com", "campaignId": "test-campaign"}'
```

#### Email-Specific File Changes and Rebuild Times

| File/Directory | Change Type | Rebuild Time | Impact |
|----------------|-------------|--------------|--------|
| `lambda/shared/src/utils/spintax.ts` | Spintax logic | 10-20s | Layer + all functions |
| `lambda/shared/src/utils/logger.ts` | Logging changes | 10-20s | Layer + all functions |
| `lambda/send-email/src/**/*.ts` | Email sending logic | 2-5s | SendEmail function only |
| `lambda/api/campaigns/src/**/*.ts` | Campaign API | 2-5s | Campaigns function only |
| `lambda/shared/src/clients/ses.client.ts` | SES client config | 10-20s | Layer + all functions |
| `tests/unit/spintax.test.ts` | Test file | N/A | No rebuild (excluded) |

#### Verifying Hot Reload Configuration

Run the hot reload test script to verify your configuration is correct:

```bash
# Check hot reload configuration
bun run scripts/test-hot-reload.ts
```

Expected output:

```
=== Hot Reload Configuration Check ===

1. Checking watch exclusions...
   OK tests/** excluded
   OK node_modules/** excluded
   OK dist/** excluded

2. Checking samconfig.toml configuration...
   OK Watch mode enabled
   OK Build caching enabled
   OK Parallel builds enabled

3. Checking SharedUtilsLayer configuration...
   OK lambda/shared/package.json exists
   OK package.json exports configured

4. Checking template.yaml BuildMethod...
   OK SharedUtilsLayer BuildMethod is nodejs20.x

=== Configuration Check Complete ===
```

### Troubleshooting Development Issues

#### Layer Not Updating

If changes to `lambda/shared/` aren't being picked up:

```bash
# Force rebuild the layer
sam build SharedUtilsLayer --force

# Verify layer content
ls .aws-sam/build/SharedUtilsLayer/

# Restart the local API
sam local start-api --watch
```

#### Function Not Finding Layer Modules

If Lambda functions can't import from the layer:

```bash
# Check layer path in function code
# Layer modules are at /opt/nodejs/shared/...

# Verify esbuild external configuration in template.yaml
# External:
#   - /opt/nodejs/shared

# Rebuild with fresh cache
rm -rf .aws-sam/build
sam build
```

#### Slow Rebuild Times

If rebuilds are taking longer than expected:

```bash
# 1. Verify cached builds are enabled
sam build --cached

# 2. Check watch exclusion file
cat .aws-sam/watch-exclude.txt

# 3. Clear old build artifacts
rm -rf .aws-sam/build

# 4. Rebuild fresh
sam build --parallel
```

#### Hot Reload Not Working

If file changes aren't triggering rebuilds:

```bash
# 1. Verify watch mode is enabled
sam local start-api --watch --debug

# 2. Check if file is excluded
# Edit .aws-sam/watch-exclude.txt if needed

# 3. Ensure you're editing source files, not dist/
# Source: lambda/*/src/**/*.ts
# Built:  lambda/*/dist/**/*.js (excluded from watch)
```

#### Environment Variables Not Loading

If Lambda functions have missing environment variables:

```bash
# Check sam-local.json environment file
cat tests/env/sam-local.json

# Verify environment variables in template.yaml Globals
# Environment:
#   Variables:
#     AWS_ENDPOINT_URL: !Ref AWSEndpointUrl

# Override environment for local testing
sam local start-api --env-vars tests/env/sam-local.json
```

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
