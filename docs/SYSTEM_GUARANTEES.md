# System Guarantees & Reliability Contracts

> **CRITICAL**: This document defines the reliability contracts of the Pivotr Mailer system. Future changes must preserve these guarantees.

## Delivery Semantics

**The system processes messages with at-least-once semantics, while enforcing effectively-once email sending through DynamoDB conditional locking.**

This design prioritizes **safety over liveness**: in rare failure scenarios (e.g., worker crash after lock acquisition but before send), an email may not be sent, but **duplicate sends are strictly prevented**.

### The Mechanism
1.  **Infrastructure (At-Least-Once)**: SQS and Lambda retries ensure that if a process fails *before* the lock, it is retried.
2.  **Application (Idempotency Gate)**: The `send-email` Lambda uses a DynamoDB Conditional Update to transition a lead from `QUEUED` -> `SENDING`.
    *   If the lock succeeds, the email is sent.
    *   If the lock fails (race condition or previous success), the request is rejected.

### Failure Modes

| Scenario | Outcome | Recovery |
| :--- | :--- | :--- |
| **SQS Duplicate** | Lock failure (ConditionCheckFailed) | Ignored (Safe) |
| **Worker Crash (Pre-Lock)** | SQS Retry | Retried (Safe) |
| **Worker Crash (Post-Lock)** | Lead stuck in `SENDING` | **Manual / Sweeper** |
| **Send Success, DB Fail** | Lead stuck in `SENDING` | **Manual / Sweeper** |

## Engineering Warnings

### Do not confuse "Idempotent" with "Exactly-Once"
Do not assume the system guarantees every email is sent exactly once without fail. We guarantee that **side effects (emails) occur at most once**.
*   **NEVER** remove the `CONDITION status='QUEUED'` check to "fix" stuck leads. This will reintroduce duplicate sends.
*   **NEVER** assume a retried message is safe to process without checking the lock.
