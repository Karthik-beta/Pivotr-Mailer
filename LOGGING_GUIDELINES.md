# Logging Guidelines for Pivotr Mailer

## Philosophy: Wide Events over Log Lines

> **"Stop thinking about logs as a debugging diary. Start thinking about them as a structured record of business events."**

Based on the principles from [Logging Sucks](https://loggingsucks.com/), Pivotr Mailer adopts a **Wide Events** (Canonical Log Lines) approach to observability.

---

## Core Principles

### 1. One Wide Event Per Operation

Instead of emitting multiple log lines per email operation:

```typescript
// ❌ BAD: Multiple scattered logs
console.log("Starting email verification");
console.log("Email verified successfully");
console.log("Sending email");
console.log("Email sent");
```

Emit **one comprehensive event** at the end of each operation:

```typescript
// ✅ GOOD: Single wide event with full context
{
  timestamp: "2025-01-04T17:40:00.000Z",
  eventType: "EMAIL_SENT",
  leadId: "lead_123",
  campaignId: "camp_456",
  duration_ms: 1247,
  lead: {
    email: "user@example.com",
    fullName: "John Doe",
    company: "Acme Corp",
    status: "SENT"
  },
  verification: {
    status: "Valid",
    provider: "myemailverifier",
    latency_ms: 450,
    isDisposable: false,
    isCatchAll: false,
    diagnosis: "Mailbox Exists and Active"
  },
  email: {
    provider: "aws_ses",
    messageId: "ses_msg_789",
    latency_ms: 342,
    resolvedSubject: "Hi John, quick question",
    templateId: "welcome_v2"
  },
  campaign: {
    name: "Q1 Outreach",
    allowCatchAll: false,
    mode: "PRODUCTION"
  },
  error: null
}
```

### 2. Include Business Context

Every log event should include:

| Context | Fields |
|---------|--------|
| **Request Identity** | `leadId`, `campaignId`, `eventType` |
| **Timing** | `timestamp`, `duration_ms`, `processingTimeMs` |
| **Lead Data** | `email`, `fullName`, `company`, `status` |
| **Verification** | `verifierResponse`, `diagnosis`, `isDisposable` |
| **Email Delivery** | `sesMessageId`, `provider`, `latency_ms` |
| **Campaign Context** | `campaignName`, `mode`, `allowCatchAll` |
| **Error Details** | `errorType`, `errorCode`, `errorMessage`, `stack`, `retriable` |

### 3. High Cardinality is Your Friend

High-cardinality fields (many unique values) are what make logs useful:

```typescript
// ✅ Include high-cardinality fields
{
  leadId: "lead_abc123",        // Unique per lead
  campaignId: "camp_xyz789",    // Unique per campaign
  sesMessageId: "ses_msg_...",  // Unique per email
  email: "user@example.com",    // Unique per lead
}
```

These enable powerful queries like:
- "Show all emails to `@acme.com` domain that bounced"
- "Show verification failures for campaign `camp_xyz789`"

---

## Implementation in Pivotr Mailer

### Log Structure

All logs should use the `Log` interface from `shared/types/log.types.ts`:

```typescript
interface Log {
  eventType: EventTypeValue;     // Classification
  severity: LogSeverityType;     // INFO, WARN, ERROR, FATAL
  message: string;               // Human-readable summary
  
  leadId: string | null;         // Lead reference
  campaignId: string | null;     // Campaign reference
  
  // Full resolved email for audit
  resolvedSubject: string | null;
  resolvedBody: string | null;
  templateVariables: TemplateVariables | null;
  
  // External API responses
  verifierResponse: Record<string, unknown> | null;
  sesResponse: Record<string, unknown> | null;
  sqsMessage: Record<string, unknown> | null;
  
  // Performance
  processingTimeMs: number | null;
  
  // Error details
  errorDetails: ErrorDetails | null;
  
  // Extensible context
  metadata: Record<string, unknown> | null;
}
```

### Event Types

Use the predefined event types from `shared/constants/event.constants.ts`:

| Category | Event Types |
|----------|-------------|
| **Verification** | `VERIFICATION_STARTED`, `VERIFICATION_PASSED`, `VERIFICATION_FAILED`, `VERIFICATION_RISKY` |
| **Email** | `EMAIL_SENDING`, `EMAIL_SENT`, `EMAIL_FAILED`, `EMAIL_BOUNCED`, `EMAIL_COMPLAINED` |
| **Campaign** | `CAMPAIGN_STARTED`, `CAMPAIGN_PAUSED`, `CAMPAIGN_RESUMED`, `CAMPAIGN_COMPLETED` |
| **System** | `SYSTEM_ERROR`, `SYSTEM_WARNING` |

### Logging in Lead Processing

Build the event throughout the operation, emit once at the end:

```typescript
async function processLead(lead: Lead, config: ProcessConfig): Promise<ProcessResult> {
  const startTime = Date.now();
  
  // Build context progressively
  const context = {
    leadId: lead.$id,
    campaignId: config.campaign.$id,
    lead: {
      email: lead.email,
      fullName: lead.fullName,
      company: lead.companyName,
    },
  };
  
  try {
    // Verification step
    const verificationStart = Date.now();
    const verification = await verifyEmail(lead.email, verifierConfig);
    context.verification = {
      status: verification.status,
      latency_ms: Date.now() - verificationStart,
      isValid: verification.isValid,
      diagnosis: verification.diagnosis,
      rawResponse: verification.rawResponse,
    };
    
    // ... more processing ...
    
    // Final log at end
    await logInfo(
      appwriteClient,
      EventType.EMAIL_SENT,
      `Email sent to ${lead.email}`,
      {
        ...context,
        processingTimeMs: Date.now() - startTime,
      }
    );
    
  } catch (error) {
    // Log error with full context
    await logError(
      appwriteClient,
      EventType.EMAIL_FAILED,
      `Failed to process ${lead.email}: ${error.message}`,
      {
        ...context,
        processingTimeMs: Date.now() - startTime,
        errorDetails: {
          type: error.name,
          message: error.message,
          stack: error.stack,
          retriable: error.retriable ?? false,
        },
      }
    );
  }
}
```

---

## Querying Logs

With wide events, you can run powerful queries:

### Example Queries

```sql
-- All failed verifications for a campaign
SELECT * FROM logs 
WHERE eventType = 'VERIFICATION_FAILED' 
  AND campaignId = 'camp_xyz'
ORDER BY timestamp DESC;

-- Average processing time by status
SELECT 
  metadata->>'$.verification.status' as status,
  AVG(processingTimeMs) as avg_time_ms,
  COUNT(*) as count
FROM logs
WHERE eventType = 'EMAIL_SENT'
GROUP BY status;

-- All bounces from @gmail.com domains
SELECT * FROM logs
WHERE eventType = 'EMAIL_BOUNCED'
  AND metadata->>'$.lead.email' LIKE '%@gmail.com';
```

---

## What NOT to Do

### ❌ Don't scatter logs

```typescript
// BAD
console.log("Starting verification");
// ... 50 lines later ...
console.log("Verification complete");
// ... 100 lines later ...
console.log("Email sent");
```

### ❌ Don't log without context

```typescript
// BAD
logger.error("Payment failed");

// GOOD
logger.error("Payment failed", {
  leadId: lead.$id,
  campaignId: campaign.$id,
  email: lead.email,
  errorCode: error.code,
  errorMessage: error.message,
});
```

### ❌ Don't use string concatenation

```typescript
// BAD
console.log(`User ${userId} did ${action} on ${resource}`);

// GOOD (structured)
logInfo(client, EventType.USER_ACTION, "User action performed", {
  userId,
  action,
  resource,
});
```

---

## Severity Levels

| Level | When to Use |
|-------|-------------|
| **INFO** | Normal operations: email sent, verification passed, campaign started |
| **WARN** | Risky but proceeding: catch-all domain accepted, retry attempted |
| **ERROR** | Operation failed but system continues: email failed, verification error |
| **FATAL** | System cannot continue: database unavailable, critical config missing |

---

## Sampling Considerations

At scale, consider implementing:

1. **Keep all errors** (100% sampling for ERROR/FATAL)
2. **Sample successful operations** (10-20% for INFO)
3. **Keep interesting events** (high-value campaigns, VIP leads)

```typescript
function shouldLog(event: LogEvent): boolean {
  // Always log errors
  if (event.severity === 'ERROR' || event.severity === 'FATAL') {
    return true;
  }
  
  // Always log high-value campaigns
  if (event.metadata?.campaign?.isHighValue) {
    return true;
  }
  
  // Sample successful operations
  return Math.random() < 0.1; // 10% sample
}
```

---

## Summary

| Principle | Implementation |
|-----------|---------------|
| One event per operation | Use `logInfo/logError` once at end |
| Include full context | Populate all relevant fields |
| High cardinality | Include IDs, emails, campaign names |
| Structured data | Use `metadata` for custom fields |
| Business context | Include verification results, template info |

**Remember:** Your future self debugging at 2 AM will thank you for including that extra context today.
