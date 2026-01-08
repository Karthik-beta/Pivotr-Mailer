# Send Email Lambda

This Lambda function handles email sending through AWS SES.

## Trigger
- SQS Queue: `pivotr-sending-queue`

## Responsibilities
1. Fetch lead data from DynamoDB
2. Apply Spintax variations
3. Inject personalization variables
4. Send email via SES
5. Log result to DynamoDB
6. Update metrics atomically
7. Schedule next email with Gaussian delay

## Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Memory | 256 MB |
| Timeout | 30 seconds |
| Reserved Concurrency | 5 |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DYNAMODB_TABLE_LEADS` | Leads table name |
| `DYNAMODB_TABLE_LOGS` | Logs table name |
| `DYNAMODB_TABLE_METRICS` | Metrics table name |
| `SES_FROM_EMAIL` | Verified sender email |
| `SQS_SENDING_QUEUE_URL` | Sending queue URL |
