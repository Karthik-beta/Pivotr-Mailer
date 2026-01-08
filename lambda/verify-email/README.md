# Verify Email Lambda

This Lambda function handles Just-In-Time email verification via MyEmailVerifier API.

## Trigger
- SQS Queue: `pivotr-verification-queue`

## Responsibilities
1. Call MyEmailVerifier API
2. Parse verification result
3. Update lead verification status in DynamoDB
4. Route to send queue if valid, or mark as skipped

## Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Memory | 256 MB |
| Timeout | 15 seconds |
| Reserved Concurrency | 3 |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MYEMAILVERIFIER_API_KEY` | API key (from Secrets Manager) |
| `DYNAMODB_TABLE_LEADS` | Leads table name |
| `SQS_SENDING_QUEUE_URL` | Sending queue URL |
