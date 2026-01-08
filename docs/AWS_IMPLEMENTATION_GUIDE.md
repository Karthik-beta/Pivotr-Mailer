# AWS CDK Implementation Guide for Pivotr Mailer

> **For AI Agents**: This is the master implementation guide. Follow steps sequentially, mark progress with checkboxes, and reference official AWS documentation.

---

## Prerequisites (Already Complete)

- [x] AWS Account configured
- [x] SES -> SNS -> SQS pipeline configured
- [x] SES verified domain/email
- [x] CDK v2.1100.3 initialized in `infrastructure/`
- [x] Environment variables defined in `.env`

**Existing AWS Resources (Do NOT recreate):**
- SES Configuration Set
- SNS Topics (for SES notifications)
- SQS Queue (for bounce/complaint handling)

---

## Phase 1: CDK Foundation

### 1.1 Environment Configuration
- [ ] Create `infrastructure/lib/config/environment.ts`
- [ ] Define interface for environment variables
- [ ] Load AWS credentials from environment (not hardcoded)
- [ ] Create separate configs for `dev` and `production`

### 1.2 Stack Structure
- [ ] Create modular constructs in `infrastructure/lib/constructs/`
- [ ] Each construct should be a separate file
- [ ] Constructs to create:
  - `dynamodb-tables.ts`
  - `lambda-functions.ts`
  - `api-gateway.ts`
  - `monitoring.ts`

---

## Phase 2: DynamoDB Tables

### 2.1 Table Definitions
Create the following tables with appropriate partition keys and sort keys:

| Table | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| `Leads` | `id` (String) | - | Store lead information |
| `Campaigns` | `id` (String) | - | Campaign definitions |
| `Logs` | `campaignId` (String) | `timestamp` (String) | Audit logs per campaign |
| `Metrics` | `campaignId` (String) | `date` (String) | Aggregated metrics |
| `Settings` | `key` (String) | - | Application settings |

### 2.2 Table Requirements
- [ ] Enable Point-in-Time Recovery (PITR)
- [ ] Set `removalPolicy: RETAIN` for production
- [ ] Enable `deletionProtection` for production
- [ ] Add Global Secondary Indexes (GSI) where needed:
  - Leads: GSI on `email` for duplicate checking
  - Leads: GSI on `status` for filtering
  - Logs: GSI on `leadId` for per-lead history
- [ ] Apply tags: `Project`, `Environment`

### 2.3 Implementation Steps
1. [ ] Create `infrastructure/lib/constructs/dynamodb-tables.ts`
2. [ ] Define table construct with all tables
3. [ ] Export table ARNs and names as stack outputs
4. [ ] Import construct into main stack
5. [ ] Run `cdk synth` to verify

---

## Phase 3: Lambda Functions

### 3.1 Function Inventory

| Function | Trigger | Concurrency | Timeout | Memory |
|----------|---------|-------------|---------|--------|
| `send-email` | SQS (sending-queue) | 5 | 30s | 256 MB |
| `verify-email` | SQS (verification-queue) | 3 | 15s | 256 MB |
| `process-feedback` | SQS (existing queue) | 10 | 10s | 128 MB |
| `lead-import` | API Gateway | 2 | 60s | 512 MB |
| `api-leads` | API Gateway | 10 | 10s | 256 MB |
| `api-campaigns` | API Gateway | 10 | 10s | 256 MB |
| `api-metrics` | API Gateway | 10 | 10s | 256 MB |

### 3.2 Lambda Requirements
- [ ] Use Node.js 20.x runtime
- [ ] Use ARM64 architecture (Graviton2) for cost savings
- [ ] Set explicit `reservedConcurrentExecutions` (MANDATORY)
- [ ] Set explicit `timeout` (MANDATORY)
- [ ] Bundle with esbuild (CDK NodejsFunction)
- [ ] Environment variables from SSM Parameter Store or Secrets Manager

### 3.3 IAM Permissions (Least Privilege)
Each Lambda needs specific permissions:

**send-email:**
- [ ] DynamoDB: Read/Write on Leads, Logs, Metrics
- [ ] SES: SendEmail, SendRawEmail
- [ ] SQS: SendMessage (for scheduling next)

**verify-email:**
- [ ] DynamoDB: Read/Write on Leads
- [ ] SQS: SendMessage (to sending queue)
- [ ] Secrets Manager: GetSecretValue (for API key)

**process-feedback:**
- [ ] DynamoDB: Read/Write on Leads, Metrics, Campaigns
- [ ] SQS: ReceiveMessage, DeleteMessage

**api-* functions:**
- [ ] DynamoDB: Read/Write on respective tables
- [ ] API Gateway invoke permissions (automatic)

### 3.4 Implementation Steps
1. [ ] Create `infrastructure/lib/constructs/lambda-functions.ts`
2. [ ] Create Lambda function source code in `lambda/` directories
3. [ ] Each Lambda needs: `index.ts` (handler), `package.json`
4. [ ] Use `@aws-lambda-powertools/logger` for structured logging
5. [ ] Import DynamoDB table references from Phase 2 construct
6. [ ] Run `cdk synth` to verify

---

## Phase 4: SQS Queues (New Queues Only)

### 4.1 New Queues Required
The existing SQS queue handles SES feedback. Create new queues for:

| Queue | Purpose | DLQ Max Receive |
|-------|---------|-----------------|
| `pivotr-sending-queue` | Email send jobs | 3 |
| `pivotr-verification-queue` | Email verification jobs | 2 |

### 4.2 Queue Requirements
- [ ] Create corresponding Dead Letter Queues (DLQ)
- [ ] Set `maxReceiveCount` per PRD Section 5.3.5
- [ ] Set visibility timeout = Lambda timeout + buffer
- [ ] Enable encryption at rest

### 4.3 Implementation Steps
1. [ ] Create `infrastructure/lib/constructs/sqs-queues.ts`
2. [ ] Define queues with DLQs
3. [ ] Wire queues as Lambda event sources
4. [ ] Run `cdk synth` to verify

---

## Phase 5: API Gateway

### 5.1 Endpoint Structure
```
/api
├── /leads
│   ├── GET (list)
│   ├── POST (create)
│   ├── /{id} GET (read)
│   ├── /{id} PUT (update)
│   └── /{id} DELETE (delete)
├── /campaigns
│   ├── GET (list)
│   ├── POST (create)
│   ├── /{id} GET (read)
│   ├── /{id}/start POST
│   ├── /{id}/pause POST
│   └── /{id}/abort POST
├── /templates
│   ├── GET (list)
│   ├── POST (create)
│   └── /{id} PUT (update)
└── /metrics
    ├── /dashboard GET
    └── /campaign/{id} GET
```

### 5.2 API Requirements
- [ ] Use HTTP API (cheaper) or REST API (more features)
- [ ] Enable CORS for frontend origin
- [ ] No authentication initially (internal tool)
- [ ] Request validation where needed
- [ ] Response caching for metrics endpoints

### 5.3 Implementation Steps
1. [ ] Create `infrastructure/lib/constructs/api-gateway.ts`
2. [ ] Define routes and integrate with Lambda functions
3. [ ] Configure CORS
4. [ ] Export API URL as stack output
5. [ ] Run `cdk synth` to verify

---

## Phase 6: Connect Existing SES/SQS

### 6.1 Import Existing Resources
- [ ] Import existing SQS queue ARN from environment
- [ ] Create Lambda event source mapping for `process-feedback`
- [ ] Verify SES configuration set is accessible

### 6.2 SES Integration
- [ ] Lambda uses AWS SDK to call SES
- [ ] Use existing configuration set name from environment
- [ ] Use existing verified email from environment

### 6.3 Implementation Steps
1. [ ] Add environment variables to Lambda functions
2. [ ] Create SQS event source for `process-feedback` Lambda
3. [ ] Test connection to existing SQS queue
4. [ ] Verify SES permissions

---

## Phase 7: Monitoring & Alarms

### 7.1 CloudWatch Alarms (PRD Section 5.3.7)

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| LambdaErrors | Errors | > 10/5min | SNS Alert |
| LambdaDuration | Duration avg | > 80% timeout | SNS Alert |
| DynamoDBThrottles | ThrottledRequests | > 0 | SNS Alert |
| SQSMessageAge | ApproximateAgeOfOldestMessage | > 1 hour | SNS Alert |

### 7.2 CloudWatch Dashboard
- [ ] Create dashboard showing:
  - Lambda invocations and errors
  - DynamoDB read/write capacity
  - SQS queue depth
  - API Gateway latency

### 7.3 Implementation Steps
1. [ ] Create `infrastructure/lib/constructs/monitoring.ts`
2. [ ] Define alarms with SNS topic for notifications
3. [ ] Create dashboard widgets
4. [ ] Run `cdk synth` to verify

---

## Phase 8: Deployment & Testing

### 8.1 Pre-Deployment Checklist
- [ ] All constructs import correctly into main stack
- [ ] `cdk synth` produces valid CloudFormation
- [ ] `cdk diff` shows expected changes
- [ ] AWS credentials configured locally
- [ ] AWS Budgets configured (manual step in console)

### 8.2 Deployment Steps
1. [ ] Run `cdk bootstrap` (first time only)
2. [ ] Deploy to dev: `npm run deploy:dev`
3. [ ] Verify stack outputs (API URL, table names)
4. [ ] Test API endpoints manually
5. [ ] Test Lambda functions with sample events

### 8.3 Post-Deployment Verification
- [ ] All Lambda functions created with correct concurrency
- [ ] DynamoDB tables created with correct indexes
- [ ] API Gateway returns 200 on health check
- [ ] SQS queue connected to feedback Lambda
- [ ] CloudWatch alarms in OK state

---

## Phase 9: Frontend Integration

### 9.1 Update Frontend Configuration
- [ ] Update `frontend/src/lib/` to use API Gateway URL
- [ ] Remove Appwrite client code
- [ ] Create AWS API client wrapper
- [ ] Update environment variables

### 9.2 API Client Structure
- [ ] Create typed API client matching backend endpoints
- [ ] Use TanStack Query for data fetching
- [ ] Handle error responses consistently

---

## Reference Links

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/)

---

## Environment Variables Reference

From `.env` (existing):
```
AWS_SES_ACCESS_KEY_ID
AWS_SES_SECRET_ACCESS_KEY
AWS_SES_REGION=ap-south-1
AWS_SES_CONFIGURATION_SET
AWS_SES_FROM_EMAIL
AWS_SQS_QUEUE_URL
AWS_SQS_REGION=ap-south-1
```

New variables needed:
```
CDK_DEFAULT_ACCOUNT
CDK_DEFAULT_REGION=ap-south-1
MYEMAILVERIFIER_API_KEY
```

---

## Progress Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: CDK Foundation | ⬜ Not Started | |
| Phase 2: DynamoDB Tables | ⬜ Not Started | |
| Phase 3: Lambda Functions | ⬜ Not Started | |
| Phase 4: SQS Queues | ⬜ Not Started | |
| Phase 5: API Gateway | ⬜ Not Started | |
| Phase 6: Connect SES/SQS | ⬜ Not Started | |
| Phase 7: Monitoring | ⬜ Not Started | |
| Phase 8: Deployment | ⬜ Not Started | |
| Phase 9: Frontend | ⬜ Not Started | |

Legend: ⬜ Not Started | 🟡 In Progress | ✅ Complete
