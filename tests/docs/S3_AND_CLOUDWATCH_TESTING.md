# S3 and CloudWatch Testing Documentation

## Overview

This document provides comprehensive documentation for testing S3 Audit Logs and CloudWatch (Logs & Metrics) operations in the Pivotr Mailer project. These tests run against LocalStack, a local AWS emulator, to enable testing without incurring AWS costs or requiring network access.

## Table of Contents

1. [S3 Audit Logs Testing](#s3-audit-logs-testing)
2. [CloudWatch Logs Testing](#cloudwatch-logs-testing)
3. [CloudWatch Metrics Testing](#cloudwatch-metrics-testing)
4. [LocalStack Limitations](#localstack-limitations)
5. [Running the Tests](#running-the-tests)
6. [Test Utilities Reference](#test-utilities-reference)

---

## S3 Audit Logs Testing

### Purpose

The S3 Audit Logs tests validate the compliance storage system for email records. Audit logs capture all email sending activities including sends, bounces, complaints, and deliveries for regulatory compliance.

### Test File Location

```
tests/integration/s3/audit-logs.test.ts
```

### Test Categories

#### 1. Bucket Configuration Tests

Validates that the S3 bucket is properly configured for audit log storage:

- **Bucket Existence**: Verifies the audit logs bucket is available
- **Versioning**: Confirms bucket versioning is enabled (protects against accidental overwrites)
- **Lifecycle Rules**: Tests that lifecycle configuration is accepted (for cost optimization)

#### 2. Basic Object Operations

Core S3 operations required for audit logging:

| Test | Description |
|------|-------------|
| `put and get an object` | Store and retrieve raw content |
| `put and get object as JSON` | Store and parse JSON objects |
| `check if object exists` | HEAD request for object existence |
| `delete an object` | Remove objects from storage |
| `list objects with prefix` | List objects by key prefix |
| `delete objects by prefix` | Bulk delete by prefix |
| `handle large objects` | Test 100KB+ objects |

#### 3. Audit Log Storage

Tests the production audit log format and storage:

- **Key Format**: Validates `{year}/{month}/{day}/{campaignId}/{leadId}-{timestamp}.json`
- **Retrieval**: Confirms stored audit logs can be retrieved
- **Multiple Logs Per Lead**: Tests storing multiple events (SEND, DELIVERY, BOUNCE)
- **Date-Based Queries**: Retrieves logs for a specific date
- **Compliance Content**: Verifies complete email content is stored (subject, body, template variables, SES response)

#### 4. Audit Log Queries

Query operations for audit retrieval:

- **Campaign Filtering**: Query logs for a specific campaign
- **Empty Results**: Handle campaigns with no logs gracefully

#### 5. Edge Cases

- Non-existent objects return `null`
- Special characters in keys are handled
- Empty content handling (LocalStack limitation noted)
- Metadata is included with objects

### Audit Log Entry Structure

```typescript
interface AuditLogEntry {
    timestamp: string;
    leadId: string;
    campaignId: string;
    email: string;
    action: 'SEND' | 'BOUNCE' | 'COMPLAINT' | 'DELIVERY';
    sesMessageId?: string;
    resolvedSubject?: string;
    resolvedBody?: string;
    templateVariables?: Record<string, string>;
    sesResponse?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
```

---

## CloudWatch Logs Testing

### Purpose

Tests CloudWatch Logs operations for Lambda function logging and structured logging patterns used across the application.

### Test File Location

```
tests/integration/cloudwatch/logs.test.ts
```

### Test Categories

#### 1. Log Group Operations

| Test | Description |
|------|-------------|
| `create and verify log group exists` | Create log group and confirm existence |
| `handle creating existing log group idempotently` | Duplicate creation doesn't throw |
| `delete log group` | Remove log groups |
| `handle deleting non-existent log group gracefully` | No error on missing groups |

#### 2. Log Stream Operations

| Test | Description |
|------|-------------|
| `create log stream` | Create new log stream in group |
| `verify log stream exists` | Confirm stream existence |
| `return false for non-existent stream` | Proper handling of missing streams |

#### 3. Log Event Operations

| Test | Description |
|------|-------------|
| `put and get log events` | Basic log event storage/retrieval |
| `preserve message order` | Messages retrieved in order |
| `include timestamps with events` | Timestamp validation |
| `handle large log messages` | 10KB+ messages supported |
| `handle many log events` | 50+ events in single batch |

#### 4. Structured Logging

Tests JSON-formatted structured logs matching the application's logging pattern:

```typescript
interface StructuredLogEvent {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: string;
    requestId?: string;
    functionName?: string;
    data?: Record<string, unknown>;
}
```

Tests include:
- Structured log event creation and retrieval
- Data preservation (nested objects)
- All log levels (DEBUG, INFO, WARN, ERROR)

#### 5. Log Filtering

- Filter events by pattern (e.g., "ERROR")
- Note: LocalStack has limited filter pattern support

#### 6. Lambda Log Simulation

Simulates real Lambda function log patterns:
- Cold start logs (START, END, REPORT)
- Error logging patterns with retry information

### Structured Log Event Creation

```typescript
// Create a structured log event with defaults
const event = createStructuredLogEvent({
    level: 'ERROR',
    message: 'Failed to send email',
    requestId: 'req-123',
    data: {
        leadId: 'lead-123',
        error: 'Connection timeout',
    },
});
```

---

## CloudWatch Metrics Testing

### Purpose

Tests CloudWatch Metrics operations for application observability. Due to LocalStack's limited metrics support, tests focus on validating that metric publishing code is correct rather than verifying metrics are stored.

### Test File Location

```
tests/integration/cloudwatch/metrics.test.ts
```

### Test Categories

#### 1. Metric Publishing

| Test | Description |
|------|-------------|
| `publish a single metric` | Basic metric publication |
| `publish metric with dimensions` | Metrics with CampaignId, Environment dimensions |
| `publish multiple metrics at once` | Batch metric publication |
| `publish metrics with different units` | Milliseconds, Megabytes, Count units |
| `handle large metric values` | 1,000,000+ values |
| `handle zero values` | Zero is valid |
| `handle decimal values` | 0.95 success rate, etc. |

#### 2. Metric Publishing Patterns

Application-specific metric patterns:

| Pattern | Metrics |
|---------|---------|
| Campaign Metrics | CampaignEmailsSent, CampaignBounces, CampaignDeliveries, CampaignComplaints |
| Daily Cap | DailyEmailCount with Date dimension |
| Queue Depth | QueueDepth for sending/feedback queues, DLQDepth for DLQs |
| Lambda Performance | LambdaDuration, LambdaErrors, LambdaThrottles |

#### 3. Metric Listing

- List metrics in namespace
- Handle empty namespace (non-existent)

#### 4. Metric Statistics

- Attempt to get metric statistics (limited LocalStack support)

#### 5. Direct SDK Usage

- Properly formatted PutMetricData command
- Batch of 20 metrics (AWS limit per call)

#### 6. Application-Specific Metrics

| Category | Metrics |
|----------|---------|
| Reputation | BounceRate, ComplaintRate, DeliveryRate |
| Verification | EmailsVerified, VerificationsFailed, VerificationLatency |
| Import | LeadsImported, DuplicatesSkipped, ImportDuration |

### Metric Data Point Structure

```typescript
interface MetricDataPoint {
    metricName: string;
    value: number;
    unit?: string;
    dimensions?: Record<string, string>;
    timestamp?: Date;
}
```

---

## LocalStack Limitations

### S3 Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| Basic CRUD | Supported | Full support for put, get, delete, list |
| Versioning | Partial | Commands accepted but may not behave identically |
| Lifecycle Rules | Partial | Configuration accepted but not actively processed |
| Storage Class Transitions | Not Tested | Cannot test locally |
| Empty Content | Limited | May return InternalError |

### CloudWatch Logs Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| Log Groups/Streams | Supported | Full basic operation support |
| Put/Get Log Events | Supported | Core functionality works |
| Filter Log Events | Partial | Some patterns may behave differently |
| Log Insights Queries | Not Supported | Use filtering instead |
| Metric Filters | Not Supported | Test in staging/production |

### CloudWatch Metrics Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| PutMetricData | Partial | May return XML errors in some cases |
| GetMetricStatistics | Limited | Often returns empty results |
| ListMetrics | Partial | May not return all published metrics |
| Metric Alarms | Not Supported | Configure in CDK, test in production |
| Dashboards | Not Supported | Configure in AWS Console |

### Handling Limitations in Tests

Tests use try-catch blocks to handle LocalStack limitations gracefully:

```typescript
async function expectCloudWatchMetricOperation(
    operation: () => Promise<unknown>,
    description: string
): Promise<void> {
    try {
        await operation();
    } catch (error) {
        // LocalStack may not fully support CloudWatch Metrics
        if (isLocalStackLimitation(error)) {
            console.log(`Note: ${description} - LocalStack limitation`);
        } else {
            throw error; // Re-throw unexpected errors
        }
    }
}
```

---

## Running the Tests

### Prerequisites

1. **Docker Desktop**: Must be running
2. **LocalStack**: Started via Docker Compose

### Commands

```bash
# Start LocalStack
docker-compose -f tests/localstack/docker-compose.yml up -d

# Run all S3 and CloudWatch tests
bun run test:integration tests/integration/s3 tests/integration/cloudwatch

# Run specific test file
bun run test:integration tests/integration/s3/audit-logs.test.ts
bun run test:integration tests/integration/cloudwatch/logs.test.ts
bun run test:integration tests/integration/cloudwatch/metrics.test.ts

# Run with verbose output
bun run test:integration tests/integration/s3 --reporter=verbose
```

### Environment Variables

Tests automatically use LocalStack endpoints when `NODE_ENV=test`:

| Service | LocalStack Endpoint |
|---------|---------------------|
| S3 | http://localhost:4566 |
| CloudWatch Logs | http://localhost:4566 |
| CloudWatch Metrics | http://localhost:4566 |

---

## Test Utilities Reference

### S3 Helpers (`tests/utils/s3-helpers.ts`)

#### Bucket Operations

```typescript
// Check if bucket exists
await bucketExists(bucketName: string): Promise<boolean>

// Ensure bucket exists (create if needed)
await ensureBucketExists(bucketName: string): Promise<void>
```

#### Object Operations

```typescript
// Put object
await putObject(key: string, body: string | Buffer, options?: {
    bucket?: string;
    contentType?: string;
    metadata?: Record<string, string>;
}): Promise<void>

// Get object as string
await getObject(key: string, bucket?: string): Promise<string | null>

// Get object as parsed JSON
await getObjectJSON<T>(key: string, bucket?: string): Promise<T | null>

// Check object existence
await objectExists(key: string, bucket?: string): Promise<boolean>

// Delete object
await deleteObject(key: string, bucket?: string): Promise<void>

// List objects
await listObjects(prefix?: string, bucket?: string): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
}>>

// Delete objects by prefix
await deleteObjectsByPrefix(prefix: string, bucket?: string): Promise<number>
```

#### Audit Log Operations

```typescript
// Store audit log entry
await storeAuditLog(entry: AuditLogEntry): Promise<string>

// Get audit logs for date
await getAuditLogsForDate(date: Date): Promise<AuditLogEntry[]>

// Get audit logs for campaign
await getAuditLogsForCampaign(campaignId: string, date: Date): Promise<AuditLogEntry[]>

// Create test audit log entry with defaults
createAuditLogEntry(overrides?: Partial<AuditLogEntry>): AuditLogEntry

// Clear all audit logs
await clearAuditLogsBucket(): Promise<number>
```

### CloudWatch Helpers (`tests/utils/cloudwatch-helpers.ts`)

#### Log Group Operations

```typescript
// Check if log group exists
await logGroupExists(logGroupName: string): Promise<boolean>

// Ensure log group exists
await ensureLogGroupExists(logGroupName: string): Promise<void>

// Delete log group
await deleteLogGroup(logGroupName: string): Promise<void>
```

#### Log Stream Operations

```typescript
// Create log stream
await createLogStream(logGroupName: string, logStreamName: string): Promise<void>

// Check if log stream exists
await logStreamExists(logGroupName: string, logStreamName: string): Promise<boolean>
```

#### Log Event Operations

```typescript
// Put log events
await putLogEvents(
    logGroupName: string,
    logStreamName: string,
    messages: string[],
    sequenceToken?: string
): Promise<string | undefined>

// Put structured log events
await putStructuredLogEvents(
    logGroupName: string,
    logStreamName: string,
    events: StructuredLogEvent[],
    sequenceToken?: string
): Promise<string | undefined>

// Get log events
await getLogEvents(
    logGroupName: string,
    logStreamName: string,
    options?: { limit?: number; startFromHead?: boolean }
): Promise<Array<{ timestamp: number; message: string }>>

// Get structured log events
await getStructuredLogEvents<T>(
    logGroupName: string,
    logStreamName: string,
    options?: { limit?: number }
): Promise<T[]>

// Filter log events
await filterLogEvents(
    logGroupName: string,
    filterPattern: string,
    options?: { startTime?: number; endTime?: number; limit?: number }
): Promise<Array<{ timestamp: number; message: string; logStreamName: string }>>
```

#### Metrics Operations

```typescript
// Put single metric
await putMetric(metricName: string, value: number, options?: {
    namespace?: string;
    unit?: string;
    dimensions?: Record<string, string>;
}): Promise<void>

// Put multiple metrics
await putMetrics(dataPoints: MetricDataPoint[], namespace?: string): Promise<void>

// Get metric statistics
await getMetricStatistics(metricName: string, options?: {
    namespace?: string;
    startTime?: Date;
    endTime?: Date;
    period?: number;
    statistics?: string[];
}): Promise<Array<{ timestamp: Date; value: number }>>

// List metrics
await listMetrics(namespace?: string): Promise<Array<{
    metricName: string;
    namespace: string;
}>>
```

#### Test Setup Helpers

```typescript
// Setup test log group with stream
await setupTestLogGroup(
    logGroupName?: string,
    logStreamName?: string
): Promise<{ logGroupName: string; logStreamName: string }>

// Cleanup test log group
await cleanupTestLogGroup(logGroupName?: string): Promise<void>

// Wait for log events to be available
await waitForLogEvents(
    logGroupName: string,
    logStreamName: string,
    expectedCount: number,
    timeoutMs?: number
): Promise<Array<{ timestamp: number; message: string }>>

// Create structured log event with defaults
createStructuredLogEvent(overrides?: Partial<StructuredLogEvent>): StructuredLogEvent
```

---

## Production Recommendations

### CloudWatch Metrics Testing in Production

1. **Unit Test Approach (Recommended)**:
   - Mock the CloudWatch client
   - Verify correct metric data is passed
   - Test metric calculation logic in isolation

2. **Integration Test Approach**:
   - Use LocalStack for basic publish validation
   - Accept that GetMetricStatistics may be limited
   - Focus on testing the publishing logic

3. **End-to-End Approach**:
   - Test against actual AWS in a staging environment
   - Use AWS CloudWatch Metric Math for validation
   - Set up proper IAM roles and permissions

4. **Observability Best Practices**:
   - Use structured logging with correlation IDs
   - Publish custom metrics for business KPIs
   - Set up alarms in production (not testable locally)
   - Use X-Ray for distributed tracing

---

## Test Count Summary

| Test Suite | Test Count |
|------------|------------|
| S3 Audit Logs | 23 tests |
| CloudWatch Logs | 20 tests |
| CloudWatch Metrics | 19 tests |
| **Total** | **62 tests** |

---

*Last Updated: January 2026*
