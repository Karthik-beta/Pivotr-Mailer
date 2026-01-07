# AWS SES & SQS Test Suite

Test scripts for validating AWS Simple Email Service (SES) and Simple Queue Service (SQS) integration for Pivotr Mailer.

## 📋 Prerequisites

1. AWS credentials configured in `.env` at the project root:

```env
# AWS SES
AWS_SES_ACCESS_KEY_ID=your-access-key
AWS_SES_SECRET_ACCESS_KEY=your-secret-key
AWS_SES_REGION=ap-south-1

# SES Configuration Set (required for E2E pipeline test)
# This links SES events to SNS → SQS
AWS_SES_CONFIGURATION_SET=your-configuration-set-name

# From email address (must be verified in SES)
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# AWS SQS (for bounce/complaint handling)
AWS_SQS_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/123456789012/ses-notifications
AWS_SQS_REGION=ap-south-1
```

2. Install dependencies:

```bash
cd scripts/test-aws-ses-sqs
bun install
```

## 🚀 Running Tests

### Test SES Only

```bash
bun run test:ses
# or
bun run test-ses.ts
```

Tests:
- ✅ Account access and quotas
- ✅ List verified identities
- ✅ Send simple email
- ✅ Send email with tracking
- ✅ Send bulk email simulation

### Test SQS Only

```bash
bun run test:sqs
# or
bun run test-sqs.ts
```

Tests:
- ✅ Queue access and attributes
- ✅ Send mock SES events (all types)
- ✅ Receive and parse messages
- ✅ Event handler simulation

### Test E2E Pipeline (SES → SNS → SQS)

```bash
bun run test:e2e
# or
bun run test-e2e-pipeline.ts
```

This test **verifies the full pipeline**:
1. Sends a real email via SES
2. Polls SQS for the corresponding event (~30-60s)
3. Verifies the message ID matches
4. Confirms SES → SNS → SQS flow is working

### Test Everything

```bash
bun run test:all
# or
bun run test-all.ts
```

---

## 📧 SES Event Types Tested

Based on the AWS SES Configuration Set event types:

| Event Type | Description |
|------------|-------------|
| **Send** | Email accepted by SES |
| **Rendering Failure** | Template rendering failed |
| **Reject** | Email contains virus/spam |
| **Delivery** | Delivered to recipient's mail server |
| **Hard Bounce** | Permanent delivery failure |
| **Complaint** | Recipient marked as spam |
| **Delivery Delay** | Temporary issue, will retry |
| **Subscription** | List-Unsubscribe clicked |
| **Open** | Email opened (tracking pixel) |
| **Click** | Link clicked in email |

---

## 🔧 SES Sandbox Mode

If your SES account is in **sandbox mode**:

1. You can only send to **verified email addresses**
2. Verify `support@pivotr.in` in the SES console
3. Request production access for full capabilities

---

## 📊 Event Processing Architecture

```
┌──────────┐     ┌─────────────┐     ┌──────────┐
│   SES    │────▶│     SNS     │────▶│   SQS    │
│  Events  │     │   Topic     │     │  Queue   │
└──────────┘     └─────────────┘     └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │ Appwrite │
                                    │ Function │
                                    └──────────┘
                                          │
                                          ▼
                                    ┌──────────┐
                                    │ Database │
                                    │  Update  │
                                    └──────────┘
```

---

## 🛠️ Troubleshooting

### "SES account access failed"
- Check AWS credentials are correct
- Verify IAM user has `ses:*` permissions

### "No verified identities found"
- Verify at least one email/domain in SES console
- Check you're using the correct region

### "SQS Queue URL not configured"
- Create an SQS queue in AWS console
- Set up SNS → SQS subscription for SES events
- Add queue URL to `.env`

### "Send email failed" in sandbox
- Verify the recipient email in SES console
- Both sender and recipient must be verified in sandbox mode
