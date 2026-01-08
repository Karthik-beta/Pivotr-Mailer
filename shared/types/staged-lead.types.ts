/**
 * Staged Lead Types
 *
 * Types for the Excel import staging workflow.
 * Staged leads are imported leads awaiting user approval.
 */

import type { LeadTypeValue } from "../constants/status.constants";

export type ValidationField = "fullName" | "email" | "companyName";
export type ValidationSeverity = "error" | "warning";

/**
 * Validation issue for a single field
 */
export interface FieldValidationIssue {
	field: ValidationField;
	severity: ValidationSeverity;
	message: string;
}

/**
 * Staged lead document (stored in staged_leads collection)
 */
export interface StagedLead {
	/** DynamoDB item ID */
	$id?: string;

	/** Document timestamps */
	$createdAt?: string;
	$updatedAt?: string;

	/** Groups rows from same import session */
	batchId: string;

	/** Original Excel row number (1-indexed) */
	rowNumber: number;

	/** Raw imported name */
	fullName: string;

	/** Raw imported email */
	email: string;

	/** Raw imported company */
	companyName: string;

	/** Optional phone number */
	phoneNumber?: string | null;

	/** Lead type for campaign targeting */
	leadType?: LeadTypeValue | null;

	/** Additional columns as JSON */
	metadata?: Record<string, unknown>;

	/** JSON array of validation issues */
	validationErrors: FieldValidationIssue[];

	/** True if no error-severity issues */
	isValid: boolean;

	/** Upload timestamp */
	importedAt: string;

	/** User ID who uploaded */
	importedBy?: string;
}

/**
 * Input for creating a staged lead
 */
export interface StagedLeadCreateInput {
	batchId: string;
	rowNumber: number;
	fullName: string;
	email: string;
	companyName: string;
	phoneNumber?: string | null;
	leadType?: LeadTypeValue | null;
	metadata?: Record<string, unknown>;
	validationErrors: FieldValidationIssue[];
	isValid: boolean;
	importedBy?: string;
}

/**
 * Summary of an import batch
 */
export interface ImportBatchSummary {
	batchId: string;
	total: number;
	valid: number;
	invalid: number;
	warnings: number;
	importedAt: string;
	importedBy?: string;
}

/**
 * Response from save-staged-leads function
 */
export interface SaveStagedLeadsResponse {
	success: boolean;
	batchId: string;
	summary: ImportBatchSummary;
}

/**
 * Request to approve staged leads
 */
export interface ApproveStagedLeadsRequest {
	batchId: string;
	/** If provided, approve only these IDs. Otherwise approve all valid in batch */
	leadIds?: string[];
}

/**
 * Response from approve-staged-leads function
 */
export interface ApproveStagedLeadsResponse {
	success: boolean;
	imported: number;
	skipped: number;
	message: string;
}

/**
 * Request for lead export
 */
export interface ExportLeadsRequest {
	campaignId?: string;
	status?: string;
	format: "xlsx" | "csv" | "json";
	template?: boolean;
}
