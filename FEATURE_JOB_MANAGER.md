# Feature Requirements Document: Job Manager

> **Context**: This feature extends the existing Pivotr Mailer system as defined in [PRD.md](file:///c:/Users/Admin/Documents/Pivotr/Apps/Pivotr%20Mailer/PRD.md). It provides visibility and control over background jobs and scheduled tasks.

---

## Overview

The Job Manager provides a centralized dashboard to monitor and manage all background processes, including:
- Campaign execution jobs (orchestrator)
- Bulk verification jobs
- SQS polling status
- Scheduled tasks

---

## Functional Requirements

### 1. Job Types

| Job Type | Source | Description |
|----------|--------|-------------|
| `CAMPAIGN_RUN` | Orchestrator | Active campaign sending emails |
| `BULK_VERIFY` | Bulk Verify Function | Batch email verification |
| `SQS_POLL` | SQS Poller | Processing AWS SES events |
| `METRICS_FETCH` | Fetch AWS Metrics | AWS quota/stats sync |

### 2. Job Status

| Status | Description |
|--------|-------------|
| `QUEUED` | Waiting to start |
| `RUNNING` | Currently executing |
| `PAUSED` | User paused |
| `COMPLETED` | Finished successfully |
| `FAILED` | Error occurred |
| `CANCELLED` | User cancelled |

### 3. Job Dashboard UI

| Feature | Description |
|---------|-------------|
| **Job List** | Table of all jobs with type, status, progress |
| **Progress Bar** | Visual indicator for jobs with known completion % |
| **Timestamps** | Started, updated, completed times |
| **Actions** | Pause, Resume, Cancel buttons per job |
| **Logs Link** | Jump to filtered audit log for job |

### 4. Real-time Updates

- Auto-refresh job status every 5 seconds
- Visual indicator for running jobs (spinner/pulse)
- Toast notification on job complete/fail

### 5. Job History

- Retain last 100 completed jobs
- Filter by type, status, date range
- Show duration and result summary

---

## Database Schema

### `jobs` Collection (New)

```
$id: string (auto)
type: enum [CAMPAIGN_RUN, BULK_VERIFY, SQS_POLL, METRICS_FETCH]
status: enum [QUEUED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED]
referenceId: string (campaignId, etc.)
progress: integer (0-100)
progressMessage: string ("50/200 emails sent")
startedAt: datetime
updatedAt: datetime
completedAt: datetime (nullable)
errorMessage: string (nullable)
metadata: json (job-specific data)
```

---

## UI Routes

| Route | Description |
|-------|-------------|
| `/jobs` | Job dashboard with active and recent jobs |
| `/jobs/:id` | Job detail view with full logs |

---

## Appwrite Functions

| Function | Changes |
|----------|---------|
| `orchestrator` | Create/update job record on start/pause/complete |
| `bulk-verify-leads` | Create/update job record with progress |
| `sqs-poller` | Update heartbeat timestamp for polling job |

---

## Acceptance Criteria

- [ ] Jobs table displays active and recent background tasks
- [ ] Progress indicator shows for in-progress jobs
- [ ] Pause/Resume/Cancel actions work correctly
- [ ] Job status updates in real-time
- [ ] Completed jobs retained in history
- [ ] Failed jobs show error message

---

## Technical Notes

- Jobs collection provides visibility into Appwrite function executions
- Orchestrator already manages campaign state; job record mirrors this
- Consider webhook for push-based updates (vs polling)
