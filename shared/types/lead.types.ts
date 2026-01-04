import type { LeadStatusType, VerificationResultType } from "../constants/status.constants";

/**
 * Lead Document Interface
 *
 * Represents a potential email recipient in the Appwrite database.
 * Each lead transitions through the finite state machine defined by LeadStatus.
 */
export interface Lead {
	/** Appwrite document ID (auto-generated, 20 chars) */
	$id: string;

	/** Document creation timestamp */
	$createdAt: string;

	/** Document last update timestamp */
	$updatedAt: string;

	/** Raw imported name (e.g., "Mr. Rajesh Kumar Sharma") */
	fullName: string;

	/** Output from Indian Name Parser */
	parsedFirstName: string | null;

	/** RFC 5321 compliant email address */
	email: string;

	/** Lead's organization */
	companyName: string;

	/** Lead lifecycle state */
	status: LeadStatusType;

	/** Cached verifier response code */
	verificationResult: VerificationResultType | null;

	/** When JIT verification occurred */
	verificationTimestamp: string | null;

	/** AWS SES Message ID after successful send */
	sesMessageId: string | null;

	/** Bounce type from SQS feedback */
	bounceType: string | null;

	/** Detailed bounce classification */
	bounceSubType: string | null;

	/** Complaint type from feedback loop */
	complaintFeedbackType: string | null;

	/** Foreign key to campaigns collection */
	campaignId: string | null;

	/** Order in sending queue */
	queuePosition: number | null;

	/** Timestamp when processing began */
	processingStartedAt: string | null;

	/** Timestamp when fully processed */
	processedAt: string | null;

	/** Error details if processing failed */
	errorMessage: string | null;

	/** Unsubscribe flag (CAN-SPAM/GDPR compliance) */
	isUnsubscribed: boolean;

	/** Timestamp of unsubscribe action */
	unsubscribedAt: string | null;

	/** Extensible key-value store */
	metadata: Record<string, unknown> | null;
}

/**
 * Lead Create Input
 *
 * Fields required when creating a new lead document.
 */
export interface LeadCreateInput {
	fullName: string;
	email: string;
	companyName: string;
	status?: LeadStatusType;
	campaignId?: string;
	queuePosition?: number;
	metadata?: Record<string, unknown>;
}

/**
 * Lead Update Input
 *
 * Fields that can be updated on an existing lead.
 */
export interface LeadUpdateInput {
	parsedFirstName?: string | null;
	status?: LeadStatusType;
	verificationResult?: VerificationResultType | null;
	verificationTimestamp?: string | null;
	sesMessageId?: string | null;
	bounceType?: string | null;
	bounceSubType?: string | null;
	complaintFeedbackType?: string | null;
	campaignId?: string | null;
	queuePosition?: number | null;
	processingStartedAt?: string | null;
	processedAt?: string | null;
	errorMessage?: string | null;
	isUnsubscribed?: boolean;
	unsubscribedAt?: string | null;
	metadata?: Record<string, unknown> | null;
}
