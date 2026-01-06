/**
 * Status Constants
 *
 * Defines the possible states for Campaigns, Leads, and other entities.
 * Using constants prevents typo-related bugs and ensures consistency.
 */

/**
 * Campaign Status
 *
 * Lifecycle: DRAFT -> QUEUED -> RUNNING -> (PAUSED) -> COMPLETED
 */
export const CampaignStatus = {
    /** Created but not yet validated or queued */
    DRAFT: 'draft',
    /** Validated and ready for execution */
    QUEUED: 'queued',
    /** Currently processing leads */
    RUNNING: 'running',
    /** Temporarily stopped by user */
    PAUSED: 'paused',
    /** All leads processed */
    COMPLETED: 'completed',
    /** Terminated by user or system error */
    ABORTED: 'aborted',
    /** System is aborting the campaign */
    ABORTING: 'aborting',
    /** Failed due to critical error */
    FAILED: 'failed',
} as const;

export type CampaignStatusValue = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/**
 * Lead Status
 *
 * Lifecycle:
 * PENDING_IMPORT -> READY/INVALID
 * READY -> QUEUED -> VERIFYING -> SENDING -> SENT -> (BOUNCED/COMPLAINED)
 */
export const LeadStatus = {
    /** Initial state during import */
    PENDING_IMPORT: 'pending_import',
    /** Validated and ready for campaign assignment */
    READY: 'ready',
    /** Assigned to a campaign and waiting */
    QUEUED: 'queued',
    /** Email verification in progress */
    VERIFYING: 'verifying',
    /** Email validated, currently sending */
    SENDING: 'sending',
    /** Email successfully sent to ESP */
    SENT: 'sent',
    /** Email verification passed */
    VERIFIED: 'verified',
    /** Email verification failed */
    INVALID: 'invalid',
    /** Email verification uncertain/catch-all */
    RISKY: 'risky',
    /** Email bounced after sending */
    BOUNCED: 'bounced',
    /** Recipient complained (spam report) */
    COMPLAINED: 'complained',
    /** Sent but open detected (optional) */
    OPENED: 'opened',
    /** Sent and link clicked (optional) */
    CLICKED: 'clicked',
    /** Sending failed due to error */
    ERROR: 'error',
    /** User unsubscribed */
    UNSUBSCRIBED: 'unsubscribed',
} as const;

export type LeadStatusValue = (typeof LeadStatus)[keyof typeof LeadStatus];

/**
 * Email Verification Result
 */
export const VerificationResult = {
    OK: 'ok',
    INVALID: 'invalid',
    CATCH_ALL: 'catch_all',
    UNKNOWN: 'unknown',
    SPAMTRAP: 'spamtrap',
    DISPOSABLE: 'disposable',
    GREYLISTED: 'greylisted',
} as const;

export type VerificationResultValue = (typeof VerificationResult)[keyof typeof VerificationResult];

/**
 * Log Severity
 */
export const LogSeverity = {
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
} as const;

export type LogSeverityValue = (typeof LogSeverity)[keyof typeof LogSeverity];

/**
 * Metrics Scope
 */
export const MetricsScope = {
    GLOBAL: 'global',
    CAMPAIGN: 'campaign',
} as const;

export type MetricsScopeValue = (typeof MetricsScope)[keyof typeof MetricsScope];
