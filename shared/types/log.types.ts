import type { EventTypeValue } from "../constants/event.constants";
import type { LogSeverityType } from "../constants/status.constants";

/**
 * Log Document Interface
 *
 * Represents an immutable audit trail entry.
 * Logs are write-only (append-only) and should never be deleted or modified.
 */
export interface Log {
	/** Appwrite document ID (auto-generated) */
	$id: string;

	/** Log timestamp */
	$createdAt: string;

	/** Action classification */
	eventType: EventTypeValue;

	/** Reference to leads collection */
	leadId: string | null;

	/** Reference to campaigns collection */
	campaignId: string | null;

	/** Log severity level */
	severity: LogSeverityType;

	/** Human-readable description */
	message: string;

	/** Actual subject after Spintax resolution (for audit trail) */
	resolvedSubject: string | null;

	/** Full resolved email body for audit reconstruction (CRITICAL FOR COMPLIANCE) */
	resolvedBody: string | null;

	/** Variables used to render the template */
	templateVariables: TemplateVariables | null;

	/** Raw MyEmailVerifier API response */
	verifierResponse: Record<string, unknown> | null;

	/** Raw SES API response */
	sesResponse: Record<string, unknown> | null;

	/** Raw SQS notification payload */
	sqsMessage: Record<string, unknown> | null;

	/** Duration of operation in milliseconds */
	processingTimeMs: number | null;

	/** Stack trace, error codes */
	errorDetails: ErrorDetails | null;

	/** Extensible context data */
	metadata: Record<string, unknown> | null;
}

/**
 * Template Variables
 *
 * Variables used to render Spintax templates.
 * Stored in logs for audit trail reconstruction.
 */
export interface TemplateVariables {
	firstName: string;
	fullName: string;
	company: string;
	email: string;
	unsubscribeLink: string;
	[key: string]: string;
}

/**
 * Error Details
 *
 * Structured error information for debugging.
 */
export interface ErrorDetails {
	code?: string;
	message: string;
	stack?: string;
	cause?: string;
	retryCount?: number;
}

/**
 * Log Create Input
 *
 * Fields required when creating a new log entry.
 */
export interface LogCreateInput {
	eventType: EventTypeValue;
	severity: LogSeverityType;
	message: string;
	leadId?: string;
	campaignId?: string;
	resolvedSubject?: string;
	resolvedBody?: string;
	templateVariables?: TemplateVariables;
	verifierResponse?: Record<string, unknown>;
	sesResponse?: Record<string, unknown>;
	sqsMessage?: Record<string, unknown>;
	processingTimeMs?: number;
	errorDetails?: ErrorDetails;
	metadata?: Record<string, unknown>;
}
