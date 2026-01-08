# Product Requirements Document (PRD): Pivotr Mailer Automation

## 1. Executive Summary

**Pivotr Mailer** is an internal B2B email automation tool designed to streamline personalized outreach to imported leads. Unlike mass-marketing newsletters, this application focuses on sending highly personalized, text-based emails that mimic human behavior.

The application runs on a **fully serverless AWS infrastructure**, leveraging Lambda, DynamoDB, SES, SNS, SQS, and CloudWatch. It prioritizes delivery reputation through strict verification processes, Gaussian-distributed sending patterns, and robust state management with idempotent, fault-tolerant operations.

## 2. Technical Context & Constraints

* **Infrastructure:** AWS Serverless Stack (Cloud-hosted, fully managed).
* **Frontend:** TanStack Start (React 19, Vite, TanStack Router).
* **Runtime:** Bun (Strict dependency management for frontend), Node.js 20+ (Lambda runtime).
* **Environment:** Cloud-native. The system must tolerate Lambda cold starts and ensure idempotent operations for fault tolerance.
* **AWS Services Stack:**
    * **AWS Lambda:** Serverless compute for all backend logic (sending engine, verification pipeline, event processing).
    * **Amazon DynamoDB:** NoSQL database for Leads, Logs, Settings, Metrics, and Campaign state.
    * **Amazon SES (Simple Email Service):** Email transmission.
    * **Amazon SNS (Simple Notification Service):** Publishes SES feedback events (bounces, complaints, deliveries).
    * **Amazon SQS (Simple Queue Service):** Queues for event processing and sending orchestration.
    * **Amazon CloudWatch:** Centralized logging, metrics, alarms, and dashboards.
* **External Services:** MyEmailVerifier (JIT Verification), Google Workspace (Domain Auth/SPF/DKIM).

---

## 3. Core Functional Requirements

### 3.1. Lead Management & Ingestion

* **Data Import:**
    * The system must accept lead data via Manual UI Entry and Bulk Import (Excel/CSV).
    * **Required Fields:** Person Name, Email Address, Company Name.


* **Data Sanitization:**
    * Incoming data must be scrubbed for invisible characters, whitespace, duplicates, and invalid email addresses.

* **Indian Name Parsing Logic:**
    * A dedicated logic module is required to parse full names specifically for the Indian demographic.
    * The system must intelligently identify "First Name" for personalization, handling common formats (e.g., honorifics, initials, reversed Last/First ordering) to ensure the email greeting sounds natural.



### 3.2. Template Engine & Spintax

* **Spintax Support:**
    * The system must support Spintax (Spin Syntax) in both the **Email Subject** and **Email Body**.
    * *Example logic:* `{Hi|Hello|Hey}` generates a unique variant for every email sent.


* **Personalization Injection:**
    * Templates must support dynamic variable insertion (e.g., `{{FirstName}}`, `{{Company}}`) derived from the lead data and the Name Parser output.



### 3.3. The Sending Engine (Backend Core)

The sending engine is an event-driven loop that prioritizes safety and human-like behavior over speed.

#### 3.3.1. Verification Pipeline (Just-In-Time)

* **Flow:** Trigger -> Verifier API -> Validation Logic -> Send -> Timer.
* **Pipelining Optimization:** To mitigate API latency, the system must **pre-verify the next email** in the queue while the current email is undergoing its delay timer. The system should strictly *not* bulk verify all leads upfront to conserve credits and ensure fresh status.
* **Validation Logic:**
    * If `Valid`: Proceed to Send.
    * If `Invalid/Risky`: Mark as skipped in the database, log the reason, and immediately proceed to the next lead without waiting for the send timer.



#### 3.3.2. Gaussian Distribution Timing

* **Pulse Scheduling:** Emails must not be sent at fixed intervals. The system must utilize a Gaussian distribution (Bell Curve) algorithm to calculate delay intervals (e.g., random delay between 1 to 3 minutes).
* **Purpose:** To mimic manual human sending behavior and avoid spam filters.

#### 3.3.3. State Management & ACID Compliance

* **Controls:** The user must have UI controls for `Start`, `Pause`, and `Abort`.
* **Atomic Operations:**
    * The system must adhere to **ACID** (Atomicity, Consistency, Isolation, Durability) principles using DynamoDB transactions.
    * A "Send" operation is a transaction. If a Lambda invocation fails mid-execution, the system must use idempotency keys to ensure exactly-once delivery semantics. No email should be recorded as sent if it wasn't, and vice-versa.


* **Persistence:** The pause state and queue position must be persisted in DynamoDB, allowing the application to resume exactly where it left off after a restart or cold start.

### 3.4. External Integrations (API Layer)

* **AWS SES (Simple Email Service):**
    * Used strictly for the transmission of the email.


* **AWS SQS (Simple Queue Service):**
    * The application must poll or listen to SQS queues to ingest feedback events (Bounces, Complaints) generated by SES via SNS.
    * This feedback must update the specific lead's status in the database immediately to prevent future sending to damaged addresses.


* **MyEmailVerifier:**
    * API integration for the JIT verification step described in section 3.3.1.



---

## 4. Data Strategy & Logging

### 4.1. Comprehensive Audit Logging

Every action must be recorded in an immutable log table for future audit and debugging.

* **Log Entities:**
    * Timestamp of action.
    * Specific Spintax variant used (actual text sent).
    * Verifier API raw response.
    * SES Message ID.
    * SQS Bounce/Complaint details (if applicable).
    * Processing time per lead.



### 4.2. Analytics & Metrics

* **Aggregated Metrics Table:**
    * Metrics must **not** be calculated on-the-fly by querying the raw logs (to ensure performance).
    * A dedicated `Metrics` table must be updated atomically via database triggers or application logic whenever an event occurs (e.g., Email Sent, Bounce Received).


* **Key Data Points:** (To be defined in detail later, but includes Total Sent, Bounce Rate, Open Rate, Verification Pass Rate).

---

## 5. Non-Functional Requirements

### 5.1. Performance & Reliability

* **Scalability:** AWS Lambda auto-scales based on demand. The system should handle burst sending gracefully without throttling.
* **Cold Starts:** Lambda functions should be optimized for cold starts (minimal dependencies, lazy loading). Consider Provisioned Concurrency for critical paths if latency is unacceptable.
* **Fault Tolerance:** Network failures (e.g., Verifier API down) should trigger SQS-based retry with exponential backoff. Dead Letter Queues (DLQ) capture failed messages for investigation.

### 5.2. Security

* **Credential Management:** AWS IAM roles and policies must follow least-privilege principles. External API tokens (MyEmailVerifier) must be stored in AWS Secrets Manager or SSM Parameter Store, never hardcoded.
* **Domain Verification:** Google Workspace domain verification (SPF, DKIM, DMARC) must be configured for optimal deliverability. AWS SES domain identity verification is required.
* **Encryption:** Data at rest in DynamoDB must be encrypted using AWS-managed keys. Data in transit uses TLS.

### 5.3. AWS Safety Nets & Cost Controls ⚠️

> **CRITICAL:** Serverless architectures can incur unexpected costs if misconfigured. The following safeguards are **MANDATORY** and must be implemented before production deployment.

#### 5.3.1. Lambda Concurrency Limits (Reserved Concurrency)

Per [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html), reserved concurrency prevents runaway scaling and protects downstream resources.

| Lambda Function | Reserved Concurrency | Rationale |
|-----------------|---------------------|-----------|
| `send-email` | **5** | Limits parallel email sends; prevents SES throttling & cost spikes |
| `verify-email` | **3** | MyEmailVerifier API rate limiting; prevent credit exhaustion |
| `process-feedback` | **10** | SNS/SQS feedback is bursty but non-critical latency |
| `lead-import` | **2** | Infrequent bulk operations; prevent DynamoDB write spikes |
| `api-handlers` | **10** | Frontend API requests; protects against abuse |

**Implementation:**
```yaml
# In CDK/SAM template for each function:
ReservedConcurrentExecutions: 5
```

**Why Reserved Concurrency:**
- *Free to configure* (unlike Provisioned Concurrency)
- Acts as both **upper bound** (prevents scaling beyond limit) and **lower bound** (reserves capacity)
- Protects downstream services (DynamoDB, MyEmailVerifier, SES) from being overwhelmed

#### 5.3.2. AWS Budgets & Billing Alarms

Per [AWS Budgets documentation](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html), billing alarms are essential for cost visibility.

**Required Budgets:**

| Budget Name | Type | Threshold | Alert Action |
|-------------|------|-----------|--------------|
| `pivotr-mailer-monthly` | Cost | $15/month | Email at 50%, 80%, 100% |
| `lambda-invocations` | Usage | 50,000/month | Email at 80% |
| `dynamodb-writes` | Usage | 100,000 WCU/month | Email at 80% |
| `ses-sends` | Usage | 10,000 emails/month | Email at 80% |

**Budget Action (Auto-Stop):**
Configure a Budget Action to automatically apply a restrictive IAM policy when costs exceed 150% of budget. This prevents runaway costs by denying new Lambda invocations.

```json
// Example restrictive policy applied on budget breach
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Action": ["lambda:InvokeFunction"],
    "Resource": "arn:aws:lambda:*:*:function:pivotr-*"
  }]
}
```

#### 5.3.3. AWS Cost Anomaly Detection

Per [AWS Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html), machine learning can detect unusual spending patterns.

**Configuration:**
- Enable Cost Anomaly Detection in AWS Cost Explorer
- Set alert threshold: 20% above expected daily spend
- Notification: SNS topic → Email + Slack webhook

#### 5.3.4. Lambda Function Timeouts & Memory

Prevent long-running invocations from accumulating costs:

| Lambda Function | Timeout | Memory | Rationale |
|-----------------|---------|--------|-----------|
| `send-email` | **30s** | 256 MB | Email send + DynamoDB write |
| `verify-email` | **15s** | 256 MB | External API call |
| `process-feedback` | **10s** | 128 MB | Simple DynamoDB update |
| `lead-import` | **60s** | 512 MB | Bulk processing |
| `api-handlers` | **10s** | 256 MB | Quick API responses |

**Memory Optimization:**
Use [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning) to find the optimal memory/cost balance.

#### 5.3.5. Dead Letter Queues (DLQ) & Retry Limits

Prevent infinite retry loops that inflate costs:

| Queue | Max Receive Count | DLQ Retention |
|-------|-------------------|---------------|
| `sending-queue` | **3** | 14 days |
| `feedback-queue` | **5** | 14 days |
| `verification-queue` | **2** | 7 days |

**Lambda Error Handling:**
- All Lambdas must implement structured error handling
- Use `Powertools for AWS Lambda` for consistent logging and metrics
- Unrecoverable errors should NOT retry (throw specific exception type)

#### 5.3.6. SES Sending Limits & Suppression List

**SES Safeguards:**
- **Sandbox Mode:** Remain in sandbox during development (only verified emails)
- **Production Quota:** Request only what's needed (start with 10,000/day)
- **Sending Rate:** Monitor `ses:Send.Count` CloudWatch metric
- **Suppression List:** Enable account-level suppression list to auto-block bounced addresses

#### 5.3.7. CloudWatch Alarms (Operational)

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| `LambdaErrors` | Errors | > 10/5min | SNS Alert |
| `LambdaDuration` | Duration avg | > 80% timeout | SNS Alert |
| `DynamoDBThrottles` | ThrottledRequests | > 0 | SNS Alert |
| `SESBounceRate` | Reputation.BounceRate | > 5% | SNS Alert + PAUSE CAMPAIGN |
| `SESComplaintRate` | Reputation.ComplaintRate | > 0.1% | SNS Alert + PAUSE CAMPAIGN |
| `SQSApproximateAge` | ApproximateAgeOfOldestMessage | > 1 hour | SNS Alert |

**Auto-Pause Campaign on Reputation Risk:**
If bounce rate exceeds 5% or complaint rate exceeds 0.1%, automatically pause all campaigns via DynamoDB flag update. This protects SES sending reputation.

#### 5.3.8. Daily Sending Cap (Application-Level)

Implement a **hard cap** in application logic:

```typescript
// In send-email Lambda
const MAX_EMAILS_PER_DAY = 300; // Safety buffer above 200 target

const todaySent = await getTodaySendCount();
if (todaySent >= MAX_EMAILS_PER_DAY) {
  console.warn('Daily sending cap reached. Pausing campaign.');
  await pauseActiveCampaign();
  return { statusCode: 429, body: 'Daily limit reached' };
}
```

#### 5.3.9. Infrastructure-as-Code Safety

All AWS resources must be defined in CDK or SAM templates with:

- **Explicit resource limits** (concurrency, timeout, memory)
- **Tags for cost allocation** (`Project: PivotrMailer`, `Environment: Production`)
- **Deletion protection** for DynamoDB tables
- **Removal policies** that prevent accidental data loss

---

## 6. Implementation Strategy

### Phase 1: AWS Infrastructure Setup

1. Configure AWS account with proper IAM roles and policies.
2. Setup DynamoDB tables (Leads, Logs, Settings, Metrics, Campaigns) with appropriate indexes.
3. Configure SES identity verification (domain, DKIM, SPF).
4. Setup SNS topics for SES event notifications (bounces, complaints, deliveries).
5. Create SQS queues (sending queue, feedback queue, DLQ).
6. Setup CloudWatch log groups, metrics, and alarms.

### Phase 2: Lambda Functions (Backend Core)

1. Implement the Indian Name Parser logic.
2. Build the "MyEmailVerifier" integration Lambda.
3. Build the "AWS SES" sending Lambda with Gaussian timing.
4. Develop the orchestration Lambda with idempotent state management.
5. Implement SQS-triggered Lambda for bounce/complaint handling.
6. Create API Gateway endpoints for frontend integration.

### Phase 3: Frontend Implementation

1. Develop the Dashboard (Status overview, controls).
2. Build the Template Editor (Spintax input).
3. Create the Lead Management view (Import/Edit).
4. Visualize the Metrics from the pre-calculated DynamoDB table.
5. Integrate with API Gateway endpoints.

### Phase 4: Testing & Deployment

1. Unit testing of the Name Parser and Spintax logic.
2. Integration testing of the Verification -> Send flow.
3. Load testing with simulated campaign execution.
4. End-to-end testing with SES sandbox mode.
5. Production deployment with monitoring setup.

---

## 7. AWS Cost Estimation

**Use Case Assumptions:**
* ~200 emails sent per working day (Mon-Fri)
* ~22 working days per month = **~4,400 emails/month**
* All logs, metrics, and data stored indefinitely
* Single AWS region (e.g., ap-south-1 Mumbai)

### 7.1. Cost Breakdown by Service

| Service | Usage | Monthly Cost (USD) | Notes |
|---------|-------|--------------------|-------|
| **AWS SES** | 4,400 emails/month | **$0.44** | First 62,000 emails free if sent from EC2/Lambda, then $0.10/1,000 emails. Outside free tier: $0.10 × 4.4 = $0.44 |
| **AWS Lambda** | ~13,200 invocations/month (3 per email avg) | **$0.00** | 1M free requests/month + 400,000 GB-seconds. Well within free tier. |
| **Amazon DynamoDB** | ~50 MB storage, ~50K read/write units/month | **$0.00 - $2.50** | On-demand: ~$1.25 for writes + $0.25 for reads. Provisioned with free tier: $0. |
| **Amazon SQS** | ~20,000 messages/month | **$0.00** | First 1M requests free/month. |
| **Amazon SNS** | ~4,400 notifications/month | **$0.00** | First 1M notifications free/month. |
| **Amazon CloudWatch** | Logs: ~500 MB/month, 5 custom metrics | **$0.00 - $3.00** | First 5 GB logs free, 10 custom metrics free. May incur $1-3 for dashboards. |
| **API Gateway** | ~10,000 requests/month | **$0.00** | First 1M requests free/month (12 months). After: $3.50/million. |
| **Secrets Manager** | 2-3 secrets | **$0.80 - $1.20** | $0.40/secret/month. |

### 7.2. Monthly Cost Summary

| Scenario | Estimated Monthly Cost |
|----------|------------------------|
| **Within AWS Free Tier** (first 12 months) | **$0.80 - $2.00** (only Secrets Manager) |
| **Post Free Tier** (steady state) | **$3.00 - $8.00** |
| **With buffer for growth** (up to 500 emails/day) | **$5.00 - $15.00** |

### 7.3. Cost Assumptions & Notes

1. **SES Pricing:** If sending from Lambda/EC2, the first 62,000 emails/month are free. Your usage (4,400) is well within this limit.
2. **DynamoDB:** On-demand pricing is recommended for unpredictable workloads. Cost is negligible for this volume.
3. **CloudWatch Logs:** Log retention can be set to 30-90 days to reduce costs. Long-term logs can be archived to S3 Glacier (~$0.004/GB/month).
4. **No Data Transfer Costs:** Email content sent via SES doesn't incur standard data transfer charges.
5. **MyEmailVerifier:** External cost (not AWS). Typically $5-20/month for ~5,000 verifications.

### 7.4. Cost Optimization Recommendations

* Use **DynamoDB On-Demand** initially; switch to **Provisioned Capacity** with auto-scaling if patterns are predictable.
* Set **CloudWatch Log retention** to 30 days for high-volume logs; archive to S3 for compliance.
* Use **Lambda ARM64 (Graviton2)** for ~20% cost savings on compute.
* Stay within **SES Sandbox** during development (free, limited to verified emails).

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│                    TanStack Start (React 19 + Vite)                         │
│                         Hosted: Vercel/S3+CloudFront                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                        │
│                    REST API / HTTP API Endpoints                            │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Lead Import   │    │  Send Control   │    │  Metrics API    │
│     Lambda      │    │     Lambda      │    │     Lambda      │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DYNAMODB                                           │
│         Leads │ Campaigns │ Logs │ Metrics │ Settings                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SQS (Sending Queue)                                  │
│                  Messages: { leadId, campaignId, ... }                      │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SENDING ENGINE LAMBDA                                   │
│   1. Fetch lead from DynamoDB                                                │
│   2. JIT Verify with MyEmailVerifier                                         │
│   3. Apply Spintax + Personalization                                         │
│   4. Send via SES                                                            │
│   5. Log result + Update metrics                                             │
│   6. Schedule next (Gaussian delay via SQS DelaySeconds)                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AWS SES                                           │
│                    Send Personalized Email                                   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SNS (SES Notifications)                               │
│              Topics: Bounces, Complaints, Deliveries                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SQS (Feedback Queue)                                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FEEDBACK HANDLER LAMBDA                                   │
│          Update lead status in DynamoDB (bounced, complained)               │
│          Update metrics counters                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │        CLOUDWATCH           │
                    │   Logs │ Metrics │ Alarms   │
                    │        Dashboards           │
                    └─────────────────────────────┘
```