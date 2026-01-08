# Lead Import Lambda

This Lambda function handles bulk lead import from Excel/CSV files.

## Trigger
- API Gateway: POST /api/leads/import
- S3 Event: Upload to `pivotr-imports` bucket

## Responsibilities
1. Parse uploaded file (Excel/CSV)
2. Validate and sanitize data
3. Parse Indian names for personalization
4. Batch write to DynamoDB
5. Return import summary

## Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20.x |
| Memory | 512 MB |
| Timeout | 60 seconds |
| Reserved Concurrency | 2 |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DYNAMODB_TABLE_LEADS` | Leads table name |
| `S3_IMPORTS_BUCKET` | Import files bucket |
