/**
 * Lead Status Constants
 *
 * Represents the lifecycle state of a lead in the email automation pipeline.
 * Each status maps to a specific stage in the finite state machine.
 */
export const LeadStatus = {
	/** Initial state after data ingestion via CSV/manual import */
	PENDING_IMPORT: "PENDING_IMPORT",

	/** Lead has been assigned to a campaign queue */
	QUEUED: "QUEUED",

	/** Currently undergoing email verification via MyEmailVerifier */
	VERIFYING: "VERIFYING",

	/** Passed verification, awaiting send slot in Gaussian timer */
	VERIFIED: "VERIFIED",

	/** Catch-all domain detected - requires campaign.allowCatchAll flag */
	RISKY: "RISKY",

	/** Failed verification (invalid/spamtrap/disposable email) */
	INVALID: "INVALID",

	/** Email transmission in progress via AWS SES (TIMEOUT: 60s) */
	SENDING: "SENDING",

	/** Successfully delivered to AWS SES */
	SENT: "SENT",

	/** Hard/soft bounce received via AWS SQS feedback */
	BOUNCED: "BOUNCED",

	/** Spam complaint received via AWS SQS feedback */
	COMPLAINED: "COMPLAINED",

	/** Manually skipped or failed pre-validation checks */
	SKIPPED: "SKIPPED",

	/** Lead opted out via unsubscribe link */
	UNSUBSCRIBED: "UNSUBSCRIBED",

	/** Processing error occurred */
	ERROR: "ERROR",
} as const;

export type LeadStatusType = (typeof LeadStatus)[keyof typeof LeadStatus];

/**
 * Campaign Status Constants
 *
 * Represents the lifecycle state of a campaign.
 */
export const CampaignStatus = {
	/** Template defined, not yet started */
	DRAFT: "DRAFT",

	/** Leads assigned, ready to start */
	QUEUED: "QUEUED",

	/** Actively processing leads */
	RUNNING: "RUNNING",

	/** User-initiated pause */
	PAUSED: "PAUSED",

	/** Graceful shutdown in progress */
	ABORTING: "ABORTING",

	/** Terminated before completion */
	ABORTED: "ABORTED",

	/** All leads processed */
	COMPLETED: "COMPLETED",

	/** Unrecoverable error state */
	ERROR: "ERROR",
} as const;

export type CampaignStatusType = (typeof CampaignStatus)[keyof typeof CampaignStatus];

/**
 * Log Severity Constants
 */
export const LogSeverity = {
	INFO: "INFO",
	WARN: "WARN",
	ERROR: "ERROR",
	FATAL: "FATAL",
} as const;

export type LogSeverityType = (typeof LogSeverity)[keyof typeof LogSeverity];

/**
 * Metrics Scope Constants
 */
export const MetricsScope = {
	/** Global metrics across all campaigns */
	GLOBAL: "GLOBAL",

	/** Campaign-specific metrics */
	CAMPAIGN: "CAMPAIGN",
} as const;

export type MetricsScopeType = (typeof MetricsScope)[keyof typeof MetricsScope];

/**
 * Verification Result Constants
 *
 * Maps MyEmailVerifier API response codes to internal statuses.
 */
export const VerificationResult = {
	/** Email is valid and deliverable */
	OK: "ok",

	/** Email is invalid */
	INVALID: "invalid",

	/** Domain accepts all emails (risky) */
	CATCH_ALL: "catch_all",

	/** Unable to determine validity */
	UNKNOWN: "unknown",

	/** Known spam trap address */
	SPAMTRAP: "spamtrap",

	/** Disposable/temporary email service */
	DISPOSABLE: "disposable",
} as const;

export type VerificationResultType = (typeof VerificationResult)[keyof typeof VerificationResult];
