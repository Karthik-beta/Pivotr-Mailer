import type { FieldValidationIssue } from "../types/staged-lead.types";

/**
 * Email validation regex (RFC 5322 simplified)
 * Validates standard email format with local part and domain
 */
const EMAIL_REGEX =
	/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Detects cramped names where lowercase is immediately followed by uppercase
 * Examples: "SanthoshM", "RagiveGowda", "AnandaG"
 */
const CRAMPED_NAME_REGEX = /[a-z][A-Z]/;

/**
 * Detects title prefixes without proper spacing
 * Examples: "Mr.Dravid", "DR.Putta", "Mrs.Sharma"
 */
const TITLE_PREFIX_REGEX = /^(Mr|Mrs|Ms|Dr|Prof|DR|MR|MRS|MS|PROF)\./i;

/**
 * Detects single letter suffix (possible initial without last name)
 * Examples: "Ragive P", "Santhosh M"
 */
const SINGLE_LETTER_SUFFIX_REGEX = /\s[A-Z]$/;

/**
 * Validate email field
 */
export function validateEmail(email: string | null | undefined): FieldValidationIssue[] {
	const issues: FieldValidationIssue[] = [];

	// Core rule: NOT NULL
	if (!email || email.trim() === "") {
		issues.push({
			field: "email",
			severity: "error",
			message: "Email is required",
		});
		return issues;
	}

	const trimmed = email.trim();

	// RFC 5322 regex validation
	if (!EMAIL_REGEX.test(trimmed)) {
		issues.push({
			field: "email",
			severity: "error",
			message: "Invalid email format",
		});
	}

	return issues;
}

/**
 * Validate name field with smart detection of formatting issues
 */
export function validateName(name: string | null | undefined): FieldValidationIssue[] {
	const issues: FieldValidationIssue[] = [];

	// Core rule: NOT NULL
	if (!name || name.trim() === "") {
		issues.push({
			field: "fullName",
			severity: "error",
			message: "Name is required",
		});
		return issues;
	}

	const trimmed = name.trim();

	// Detect cramped names (lowercase followed by uppercase)
	if (CRAMPED_NAME_REGEX.test(trimmed)) {
		issues.push({
			field: "fullName",
			severity: "warning",
			message: "Possible missing space in name",
		});
	}

	// Detect title prefix without space
	if (TITLE_PREFIX_REGEX.test(trimmed)) {
		issues.push({
			field: "fullName",
			severity: "warning",
			message: "Title may need space after period",
		});
	}

	// Detect single letter suffix (possible incomplete name)
	if (SINGLE_LETTER_SUFFIX_REGEX.test(trimmed)) {
		issues.push({
			field: "fullName",
			severity: "warning",
			message: "Name ends with single initial - verify last name",
		});
	}

	return issues;
}

/**
 * Validate company name field
 */
export function validateCompanyName(company: string | null | undefined): FieldValidationIssue[] {
	const issues: FieldValidationIssue[] = [];

	// Core rule: NOT NULL
	if (!company || company.trim() === "") {
		issues.push({
			field: "companyName",
			severity: "error",
			message: "Company name is required",
		});
		return issues;
	}

	const trimmed = company.trim();

	// Detect very short company names
	if (trimmed.length < 2) {
		issues.push({
			field: "companyName",
			severity: "warning",
			message: "Company name seems too short",
		});
	}

	// Detect cramped words in company name
	if (CRAMPED_NAME_REGEX.test(trimmed)) {
		issues.push({
			field: "companyName",
			severity: "warning",
			message: "Possible missing space in company name",
		});
	}

	return issues;
}

/**
 * Validate a complete staged lead row
 * Returns all validation issues and overall validity status
 */
export function validateStagedLead(lead: {
	fullName?: string | null;
	email?: string | null;
	companyName?: string | null;
}): { issues: FieldValidationIssue[]; isValid: boolean } {
	const issues: FieldValidationIssue[] = [
		...validateName(lead.fullName),
		...validateEmail(lead.email),
		...validateCompanyName(lead.companyName),
	];

	// A lead is valid only if there are no errors (warnings are acceptable)
	const isValid = !issues.some((issue) => issue.severity === "error");

	return { issues, isValid };
}
