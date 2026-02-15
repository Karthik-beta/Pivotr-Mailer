/**
 * Lead Types
 *
 * Centralized type definitions for Lead entities.
 * Shared across all Lambda functions to ensure consistency.
 */

/**
 * Lead status enum representing the lifecycle of a lead.
 */
export type LeadStatus =
	| "PENDING_IMPORT"
	| "QUEUED"
	| "VERIFIED"
	| "SENT"
	| "DELIVERED"
	| "BOUNCED"
	| "COMPLAINED"
	| "FAILED"
	| "SKIPPED_DAILY_CAP"
	| "UNSUBSCRIBED";

/**
 * Lead type categorization.
 */
export type LeadType = "HARDWARE" | "SOFTWARE" | "BOTH";

/**
 * Base lead document structure.
 */
export interface Lead {
	/** Unique identifier (UUID) */
	id: string;
	/** Full name of the contact */
	fullName: string;
	/** Email address (lowercase) */
	email: string;
	/** Company name */
	companyName: string;
	/** Phone number (optional) */
	phoneNumber?: string;
	/** Lead type categorization */
	leadType?: LeadType;
	/** Current status in lifecycle */
	status: LeadStatus;
	/** Assigned campaign ID (if any) */
	campaignId?: string;
	/** Parsed first name (extracted from fullName) */
	parsedFirstName?: string;
	/** ISO timestamp of creation */
	createdAt: string;
	/** ISO timestamp of last update */
	updatedAt: string;
	/** ISO timestamp of last email sent */
	sentAt?: string;
	/** SES message ID of last email */
	lastMessageId?: string;
}

/**
 * All valid lead statuses for runtime validation.
 */
export const VALID_LEAD_STATUSES: readonly LeadStatus[] = [
	"PENDING_IMPORT",
	"QUEUED",
	"VERIFIED",
	"SENT",
	"DELIVERED",
	"BOUNCED",
	"COMPLAINED",
	"FAILED",
	"SKIPPED_DAILY_CAP",
	"UNSUBSCRIBED",
] as const;

/**
 * Type guard to check if a value is a valid LeadStatus.
 */
export function isValidLeadStatus(value: unknown): value is LeadStatus {
	return (
		typeof value === "string" &&
		VALID_LEAD_STATUSES.includes(value as LeadStatus)
	);
}
