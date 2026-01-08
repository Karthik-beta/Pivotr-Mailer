# Feature Requirements Document: Campaign Manager

> **Context**: This feature extends the existing Pivotr Mailer system as defined in [PRD.md](file:///c:/Users/Admin/Documents/Pivotr/Apps/Pivotr%20Mailer/PRD.md). It builds upon the existing Lead Management, Template Engine, and Sending Engine components.

---

## Overview

The Campaign Manager provides a UI layer to orchestrate the backend sending engine defined in PRD Section 3.3. It allows users to:
- Create named campaigns
- Configure templates with Spintax support (per PRD 3.2)
- Select which lead types to target
- Send test emails before launching
- Track per-campaign metrics

---

## Functional Requirements

### 1. Campaign Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | ✅ | User-provided unique campaign identifier |
| `description` | String | ❌ | Optional notes |
| `leadTypes` | Array | ✅ | Target lead types (Cold, Warm, Hot, etc.) |
| `fromEmail` | String | ✅ | Sender email (verified in SES) |
| `fromName` | String | ✅ | Sender display name |
| `ccEmail` | String | ❌ | Optional CC recipient for all campaign emails |
| `status` | Enum | ✅ | DRAFT → QUEUED → RUNNING → PAUSED → COMPLETED → ABORTED |

### 2. Template Preparation (per PRD 3.2)

- **Subject**: Text input with **Spintax** support (`{Hi|Hello|Hey}`)
- **Body**: Rich text editor with **Spintax** and **Variables** (`{{FirstName}}`, `{{Company}}`)
- **Preview**: Sample render with test lead data
- **Variables**: Derived from lead data + Indian Name Parser output (PRD 3.1)

### 3. Lead Type Selection

- Multi-select for lead types to include
- Auto-exclude: bounced, complained, unsubscribed leads
- Show lead count preview before campaign start

### 4. Bulk Verification (Optional Pre-Send)

When leads are loaded/selected for a campaign, provide option to bulk verify:

| Feature | Description |
|---------|-------------|
| **Verify Button** | "Verify All Unverified Leads" action |
| **Skip Already Verified** | Only verify leads NOT already verified (conserves credits) |
| **Progress Indicator** | Shows X/Y verified with pass/fail counts |
| **Batch Processing** | Verify in batches (e.g., 50 at a time) to manage API rate limits |
| **Credits Display** | Show estimated credits needed (unverified count × cost) |
| **Results Summary** | After completion: Valid, Invalid, Risky, Catch-All counts |

> **IMPORTANT:** The app must check `lead.verificationStatus` before calling the verifier API. If a lead already has a verification result (`VERIFIED`, `INVALID`, `RISKY`, etc.), it should be **skipped** to conserve API credits. Only leads with no verification status are sent to MyEmailVerifier.

**Verification Outcomes:**
- `VERIFIED` → Eligible for sending
- `INVALID` → Auto-excluded from campaign
- `RISKY` / `CATCH_ALL` → Based on user's sending criteria (Section 5)

> Note: This differs from PRD 3.3.1 JIT verification. Bulk verification is *optional* and pre-emptive; JIT still applies at send time for any unverified leads (and also skips already-verified).

### 5. Sending Criteria (Risk Level Configuration)

Allow users to customize which verification statuses are eligible for sending:

| Verification Status | Default | Description |
|---------------------|---------|-------------|
| `OK` / `Valid` | ✅ Send | Email confirmed deliverable |
| `Catch-All` | ⚠️ User Choice | Server accepts all emails |
| `Unknown` | ⚠️ User Choice | Unable to determine |
| `Risky` | ❌ Skip | High bounce probability |
| `Invalid` | ❌ Skip | Email does not exist |
| `Spamtrap` | ❌ Skip | Known spam trap |
| `Disposable` | ❌ Skip | Temporary email service |

**UI Controls:**
- Toggle switches for each status type
- Presets: "Safe Only", "Moderate Risk", "Aggressive"
- Warning banner when risky options enabled

**Stored Per Campaign:**
```
sendCriteria: {
  allowCatchAll: boolean,
  allowUnknown: boolean,
  allowRisky: boolean  // Advanced override
}
```

### 6. Test Email Button

| Feature | Description |
|---------|-------------|
| **Input Field** | Internal email address for test delivery |
| **Variable Preview** | Optionally override template variables |
| **Send Test** | Fires single email via AWS SES (bypasses verification) |
| **Result** | Shows SES MessageId or error message |

> Note: Test emails do not count toward campaign metrics.

### 6. Campaign Controls (per PRD 3.3.3)

- **Start**: Begins the event loop (Verification → Send → Timer)
- **Pause**: Persists state; resume continues from exact position
- **Abort**: Terminates campaign permanently

### 6. Per-Campaign Metrics (per PRD 4.2)

Uses the existing `metrics` collection with `scope: CAMPAIGN`:

| Metric | Source |
|--------|--------|
| `totalLeadsImported` | Lead assignment |
| `totalEmailsSent` | SES send confirmation |
| `totalDelivered` | SQS Delivery event |
| `totalBounces` / `totalHardBounces` / `totalSoftBounces` | SQS Bounce event |
| `totalComplaints` | SQS Complaint event |
| `totalOpens` | SQS Open event |
| `totalClicks` | SQS Click event |
| `totalVerificationPassed` / `totalVerificationFailed` | Verifier API |

---

## Database Schema

### Existing: `campaigns` Collection

Already exists per [003_create_campaigns.ts](file:///c:/Users/Admin/Documents/Pivotr/Apps/Pivotr%20Mailer/migrations/003_create_campaigns.ts).

### Existing: `metrics` Collection

Already supports `scope: CAMPAIGN` with `scopeId` per [005_create_metrics.ts](file:///c:/Users/Admin/Documents/Pivotr/Apps/Pivotr%20Mailer/migrations/005_create_metrics.ts).

**No new collections required.**

---

## UI Routes

| Route | Description |
|-------|-------------|
| `/campaigns` | List all campaigns with status, metrics summary |
| `/campaigns/new` | Create new campaign form |
| `/campaigns/:id` | Edit campaign, template, view metrics |
| `/campaigns/:id/metrics` | Detailed metrics dashboard |

---

## Appwrite Functions

| Function | Status | Purpose |
|----------|--------|---------|
| `orchestrator` | ✅ Exists | Campaign execution engine |
| `sqs-poller` | ✅ Exists | Event feedback processing |
| `create-lead` | ✅ Exists | Lead management |
| **`send-test-email`** | 🆕 New | Single test email (no verification) |
| **`bulk-verify-leads`** | 🆕 New | Batch verify leads via MyEmailVerifier API |

---

## Acceptance Criteria

- [ ] User creates campaign with unique name
- [ ] User prepares template with Spintax/variables
- [ ] User selects target lead types
- [ ] User can bulk verify unverified leads before starting
- [ ] Bulk verification shows progress and results summary
- [ ] User sends test email to internal address
- [ ] Test result shows success/failure
- [ ] Start/Pause/Abort controls work correctly
- [ ] State persists across restarts (ACID per PRD 3.3.3)
- [ ] Campaign metrics displayed from `metrics` collection

---

## Technical Notes

- Campaign execution uses existing `orchestrator` function
- Metrics already tracked per-campaign via `campaignId` tag in SQS events
- Test emails should skip verification (trusted internal address)
- Indian Name Parser applies during template rendering (PRD 3.1)
