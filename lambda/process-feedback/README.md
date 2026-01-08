# Process Feedback Lambda

This Lambda function handles SES feedback events (bounces, complaints, deliveries).

## Trigger
- SQS Queue: `pivotr-feedback-queue` (subscribed to SNS topic)

## Responsibilities
1. Parse SNS notification from SES
2. Identify event type (bounce, complaint, delivery)
3. Update lead status in DynamoDB
4. Update metrics counters
5. Auto-pause campaign if reputation thresholds exceeded

## Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Memory | 128 MB |
| Timeout | 10 seconds |
| Reserved Concurrency | 10 |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DYNAMODB_TABLE_LEADS` | Leads table name |
| `DYNAMODB_TABLE_METRICS` | Metrics table name |
| `DYNAMODB_TABLE_CAMPAIGNS` | Campaigns table name |
| `BOUNCE_THRESHOLD` | Max bounce rate (default: 0.05) |
| `COMPLAINT_THRESHOLD` | Max complaint rate (default: 0.001) |

## Event Types Handled

| Event | Action |
|-------|--------|
| `Bounce` | Mark lead as `bounced`, increment bounce counter |
| `Complaint` | Mark lead as `complained`, increment complaint counter |
| `Delivery` | Mark lead as `delivered`, increment delivery counter |
