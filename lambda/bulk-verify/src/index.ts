/**
 * Bulk Verify Lambda
 *
 * Handles batch verification of leads:
 * - Email verification via MyEmailVerifier API
 * - Name validation (Indian name patterns)
 * - Company name validation
 *
 * Triggered by:
 * 1. SQS messages from verification queue (automatic during campaign)
 * 2. API Gateway for manual bulk verification
 *
 * Features:
 * - Batch processing with rate limiting
 * - Credit tracking for API calls
 * - Progress tracking for UI updates
 * - Skips already-verified leads (conserves credits)
 */

import type {
	SQSHandler,
	SQSEvent,
	SQSRecord,
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Handler,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	GetCommand,
	UpdateCommand,
	QueryCommand,
	BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// =============================================================================
// Configuration
// =============================================================================

const logger = new Logger({
	serviceName: "bulk-verify",
	logLevel: (process.env.LOG_LEVEL as LogLevel) || "INFO",
});

// LocalStack support
const awsEndpoint = process.env.AWS_ENDPOINT_URL;
const awsRegion = process.env.AWS_REGION || "ap-south-1";

const clientConfig = awsEndpoint
	? { region: awsRegion, endpoint: awsEndpoint }
	: { region: awsRegion };

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
	marshallOptions: { removeUndefinedValues: true },
});

const sqsClient = new SQSClient(clientConfig);

const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || "";
const METRICS_TABLE = process.env.DYNAMODB_TABLE_METRICS || "";
const SENDING_QUEUE_URL = process.env.SQS_SENDING_QUEUE_URL || "";

// MyEmailVerifier API configuration
const EMAIL_VERIFIER_API_KEY = process.env.MYEMAILVERIFIER_API_KEY || "";
const EMAIL_VERIFIER_API_URL = "https://api.myemailverifier.com/api/verifier/verify";

// Rate limiting
const RATE_LIMIT_DELAY_MS = 200; // 5 requests per second max

// =============================================================================
// Types
// =============================================================================

interface Lead {
	id: string;
	email: string;
	fullName: string;
	companyName: string;
	status: string;
	campaignId?: string;
	verificationStatus?: string;
	verificationDetails?: VerificationDetails;
	parsedFirstName?: string;
}

interface VerificationDetails {
	emailResult?: EmailVerificationResult;
	nameValidation?: NameValidationResult;
	companyValidation?: CompanyValidationResult;
	verifiedAt: string;
}

interface EmailVerificationResult {
	status: string;
	result: string;
	domain: string;
	isDisposable: boolean;
	isCatchAll: boolean;
	isRoleAccount: boolean;
	raw?: unknown;
}

interface NameValidationResult {
	isValid: boolean;
	confidence: number;
	parsedFirstName: string;
	parsedLastName: string;
	issues: string[];
}

interface CompanyValidationResult {
	isValid: boolean;
	normalized: string;
	isCorporate: boolean;
	issues: string[];
}

interface VerificationMessage {
	leadId: string;
	campaignId: string;
	email: string;
	fullName: string;
	companyName: string;
}

interface BulkVerifyRequest {
	campaignId?: string;
	leadIds?: string[];
	maxLeads?: number;
}

// =============================================================================
// SQS Handler (for campaign-triggered verification)
// =============================================================================

export const sqsHandler: SQSHandler = async (event: SQSEvent) => {
	logger.info("Processing verification batch", { count: event.Records.length });

	// Process in chunks of 5 for concurrency control (half of batch size 10)
	// This provides a balance between speed and rate limiting safety.
	const CONCURRENCY_LIMIT = 5;
	const records = event.Records;

	for (let i = 0; i < records.length; i += CONCURRENCY_LIMIT) {
		const chunk = records.slice(i, i + CONCURRENCY_LIMIT);

		await Promise.all(chunk.map(async (record) => {
			try {
				await processVerificationRecord(record);
			} catch (error) {
				logger.error("Failed to process verification", {
					messageId: record.messageId,
					error: error instanceof Error ? error.message : String(error),
				});
				// Don't throw - let other messages process
			}
		}));

		// Small delay between chunks if there are more
		if (i + CONCURRENCY_LIMIT < records.length) {
			await sleep(RATE_LIMIT_DELAY_MS);
		}
	}
};

async function processVerificationRecord(record: SQSRecord): Promise<void> {
	const message: VerificationMessage = JSON.parse(record.body);
	const { leadId, campaignId, email, fullName, companyName } = message;

	// Get current lead to check if already verified
	const lead = await getLead(leadId);
	if (!lead) {
		logger.warn("Lead not found", { leadId });
		return;
	}

	// Skip if already verified (conserve API credits)
	if (lead.verificationStatus && lead.verificationStatus !== "pending") {
		logger.debug("Lead already verified, skipping", {
			leadId,
			status: lead.verificationStatus,
		});
		// Queue for sending if valid
		if (isValidForSending(lead.verificationStatus)) {
			await queueForSending(lead, campaignId);
		}
		return;
	}

	// Perform verification
	const details = await verifyLead(email, fullName, companyName);
	const verificationStatus = determineOverallStatus(details);

	// Update lead with verification results
	await updateLeadVerification(leadId, verificationStatus, details);

	// Update metrics
	await updateVerificationMetrics(campaignId, verificationStatus);

	// Queue for sending if valid
	if (isValidForSending(verificationStatus)) {
		await queueForSending(lead, campaignId);
	}

	logger.info("Lead verified", { leadId, status: verificationStatus });
}

// =============================================================================
// API Handler (for manual bulk verification)
// =============================================================================

export const apiHandler: Handler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = async (event) => {
	const { httpMethod, body } = event;

	try {
		if (httpMethod === "POST") {
			return await handleBulkVerifyRequest(body);
		}

		return response(405, { success: false, message: "Method not allowed" });
	} catch (error) {
		logger.error("API handler error", { error });
		return response(500, {
			success: false,
			message: error instanceof Error ? error.message : "Internal error",
		});
	}
};

async function handleBulkVerifyRequest(
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	const request: BulkVerifyRequest = JSON.parse(body);
	const maxLeads = request.maxLeads || 100;

	let leads: Lead[] = [];

	if (request.leadIds && request.leadIds.length > 0) {
		// Verify specific leads
		leads = await getLeadsByIds(request.leadIds);
	} else if (request.campaignId) {
		// Verify all unverified leads in a campaign
		leads = await getUnverifiedLeadsForCampaign(request.campaignId, maxLeads);
	} else {
		return response(400, {
			success: false,
			message: "Either leadIds or campaignId required",
		});
	}

	// Filter to only unverified leads
	const unverified = leads.filter(
		(l) => !l.verificationStatus || l.verificationStatus === "pending"
	);

	if (unverified.length === 0) {
		return response(200, {
			success: true,
			data: {
				message: "No unverified leads found",
				alreadyVerifiedCount: leads.length,
			},
		});
	}

	// Process verification
	const results = {
		total: unverified.length,
		verified: 0,
		valid: 0,
		invalid: 0,
		risky: 0,
		errors: 0,
		creditsUsed: 0,
	};

	for (const lead of unverified) {
		try {
			const details = await verifyLead(lead.email, lead.fullName, lead.companyName);
			const status = determineOverallStatus(details);

			await updateLeadVerification(lead.id, status, details);

			results.verified++;
			results.creditsUsed++;

			if (status === "ok" || status === "VERIFIED") results.valid++;
			else if (status === "invalid" || status === "INVALID") results.invalid++;
			else if (status === "catch_all" || status === "RISKY") results.risky++;

			// Rate limiting
			await sleep(RATE_LIMIT_DELAY_MS);
		} catch (error) {
			results.errors++;
			logger.error("Verification failed", { leadId: lead.id, error });
		}
	}

	// Update campaign metrics if campaignId provided
	if (request.campaignId) {
		await updateBulkVerificationMetrics(request.campaignId, results);
	}

	return response(200, {
		success: true,
		data: results,
	});
}

// =============================================================================
// Verification Logic
// =============================================================================

async function verifyLead(
	email: string,
	fullName: string,
	companyName: string
): Promise<VerificationDetails> {
	const now = new Date().toISOString();

	// 1. Verify email
	const emailResult = await verifyEmail(email);

	// 2. Validate name using existing validator
	const nameValidation = validateName(fullName);

	// 3. Validate company
	const companyValidation = validateCompany(companyName);

	return {
		emailResult,
		nameValidation,
		companyValidation,
		verifiedAt: now,
	};
}

async function verifyEmail(email: string): Promise<EmailVerificationResult> {
	// If no API key configured, return mock result for testing
	if (!EMAIL_VERIFIER_API_KEY) {
		logger.warn("Email verifier API key not configured, using mock verification");
		return mockEmailVerification(email);
	}

	try {
		const response = await fetch(
			`${EMAIL_VERIFIER_API_URL}?email=${encodeURIComponent(email)}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${EMAIL_VERIFIER_API_KEY}`,
					"Content-Type": "application/json",
				},
			}
		);

		if (!response.ok) {
			throw new Error(`API returned ${response.status}`);
		}

		const data = (await response.json()) as {
			Status?: string;
			Result?: string;
			Domain?: string;
			Disposable?: string;
			CatchAll?: string;
			Role?: string;
		};

		return {
			status: data.Status || "unknown",
			result: data.Result || "unknown",
			domain: data.Domain || email.split("@")[1],
			isDisposable: data.Disposable === "yes",
			isCatchAll: data.CatchAll === "yes",
			isRoleAccount: data.Role === "yes",
			raw: data,
		};
	} catch (error) {
		logger.error("Email verification API failed", { email, error });
		// Return unknown status on API failure
		return {
			status: "error",
			result: "unknown",
			domain: email.split("@")[1],
			isDisposable: false,
			isCatchAll: false,
			isRoleAccount: false,
		};
	}
}

function mockEmailVerification(email: string): EmailVerificationResult {
	const domain = email.split("@")[1];
	const disposableDomains = ["tempmail.com", "throwaway.com", "mailinator.com"];
	const freeProviders = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];

	return {
		status: "ok",
		result: disposableDomains.includes(domain)
			? "disposable"
			: freeProviders.includes(domain)
				? "ok"
				: "ok",
		domain,
		isDisposable: disposableDomains.includes(domain),
		isCatchAll: false,
		isRoleAccount: email.startsWith("info@") || email.startsWith("admin@"),
	};
}

function validateName(fullName: string): NameValidationResult {
	const issues: string[] = [];

	// Use existing Indian name validator pattern
	const trimmed = fullName.trim();

	// Check for minimum length
	if (trimmed.length < 2) {
		issues.push("Name too short");
	}

	// Check for numbers
	if (/\d/.test(trimmed)) {
		issues.push("Name contains numbers");
	}

	// Check for gibberish patterns
	if (/(.)\1{3,}/.test(trimmed)) {
		issues.push("Repeated characters detected");
	}

	// Check for common placeholder names
	const placeholders = ["test", "n/a", "na", "none", "null", "undefined", "xxx"];
	if (placeholders.includes(trimmed.toLowerCase())) {
		issues.push("Placeholder name detected");
	}

	// Parse first and last name
	const parts = trimmed.split(/\s+/);
	const firstName = parts[0] || "";
	const lastName = parts.slice(1).join(" ") || "";

	// Calculate confidence
	let confidence = 1.0;
	confidence -= issues.length * 0.2;
	if (parts.length < 2) confidence -= 0.1;
	confidence = Math.max(0, confidence);

	return {
		isValid: issues.length === 0 && confidence > 0.5,
		confidence,
		parsedFirstName: firstName,
		parsedLastName: lastName,
		issues,
	};
}

function validateCompany(companyName: string): CompanyValidationResult {
	const issues: string[] = [];
	const trimmed = companyName.trim();

	// Normalize
	const normalized = trimmed
		.replace(/\s+/g, " ")
		.replace(/['"]/g, "")
		.trim();

	// Check for minimum length
	if (normalized.length < 2) {
		issues.push("Company name too short");
	}

	// Check for placeholder values
	const placeholders = [
		"self",
		"n/a",
		"na",
		"none",
		"null",
		"-",
		".",
		"test",
		"company",
		"abc",
	];
	if (placeholders.includes(normalized.toLowerCase())) {
		issues.push("Placeholder company name");
	}

	// Check for corporate indicators
	const corporateIndicators = [
		"ltd",
		"limited",
		"pvt",
		"private",
		"inc",
		"corp",
		"llc",
		"llp",
		"co.",
		"technologies",
		"solutions",
		"services",
		"systems",
		"enterprises",
		"industries",
	];
	const isCorporate = corporateIndicators.some((ind) =>
		normalized.toLowerCase().includes(ind)
	);

	return {
		isValid: issues.length === 0,
		normalized,
		isCorporate,
		issues,
	};
}

// =============================================================================
// Status Determination
// =============================================================================

function determineOverallStatus(details: VerificationDetails): string {
	// Email is the primary factor
	const emailStatus = details.emailResult?.result?.toLowerCase() || "unknown";

	// Invalid email = invalid lead
	if (["invalid", "spamtrap", "disposable"].includes(emailStatus)) {
		return "INVALID";
	}

	// Check name validity
	if (!details.nameValidation?.isValid) {
		return "INVALID";
	}

	// Check company validity
	if (!details.companyValidation?.isValid) {
		return "INVALID";
	}

	// Catch-all = risky
	if (details.emailResult?.isCatchAll || emailStatus === "catch_all") {
		return "RISKY";
	}

	// Unknown = unknown
	if (emailStatus === "unknown" || emailStatus === "error") {
		return "unknown";
	}

	// Valid
	return "VERIFIED";
}

function isValidForSending(status: string): boolean {
	return ["ok", "VERIFIED", "catch_all", "RISKY"].includes(status);
}

// =============================================================================
// Database Operations
// =============================================================================

async function getLead(leadId: string): Promise<Lead | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: LEADS_TABLE,
			Key: { id: leadId },
		})
	);
	return result.Item as Lead | null;
}

async function getLeadsByIds(leadIds: string[]): Promise<Lead[]> {
	// For simplicity, fetch one by one (could optimize with BatchGetItem)
	const leads: Lead[] = [];
	for (const id of leadIds) {
		const lead = await getLead(id);
		if (lead) leads.push(lead);
	}
	return leads;
}

async function getUnverifiedLeadsForCampaign(
	campaignId: string,
	limit: number
): Promise<Lead[]> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: LEADS_TABLE,
			IndexName: "CampaignIndex",
			KeyConditionExpression: "campaignId = :campaignId",
			FilterExpression:
				"attribute_not_exists(verificationStatus) OR verificationStatus = :pending",
			ExpressionAttributeValues: {
				":campaignId": campaignId,
				":pending": "pending",
			},
			Limit: limit,
		})
	);
	return (result.Items ?? []) as Lead[];
}

async function updateLeadVerification(
	leadId: string,
	status: string,
	details: VerificationDetails
): Promise<void> {
	const now = new Date().toISOString();

	await docClient.send(
		new UpdateCommand({
			TableName: LEADS_TABLE,
			Key: { id: leadId },
			UpdateExpression:
				"SET verificationStatus = :status, verificationDetails = :details, parsedFirstName = :firstName, updatedAt = :now",
			ExpressionAttributeValues: {
				":status": status,
				":details": details,
				":firstName": details.nameValidation?.parsedFirstName || "",
				":now": now,
			},
		})
	);
}

async function updateVerificationMetrics(
	campaignId: string | undefined,
	status: string
): Promise<void> {
	if (!campaignId) return;

	const isValid = status === "VERIFIED" || status === "ok";
	const incrementField = isValid
		? "verificationPassedCount"
		: "verificationFailedCount";

	await docClient.send(
		new UpdateCommand({
			TableName: METRICS_TABLE,
			Key: { pk: "CAMPAIGN", sk: campaignId },
			UpdateExpression: `ADD ${incrementField} :inc, creditsUsed :credit`,
			ExpressionAttributeValues: {
				":inc": 1,
				":credit": 1,
			},
		})
	);
}

async function updateBulkVerificationMetrics(
	campaignId: string,
	results: { valid: number; invalid: number; creditsUsed: number }
): Promise<void> {
	await docClient.send(
		new UpdateCommand({
			TableName: METRICS_TABLE,
			Key: { pk: "CAMPAIGN", sk: campaignId },
			UpdateExpression:
				"ADD verificationPassedCount :valid, verificationFailedCount :invalid, creditsUsed :credits",
			ExpressionAttributeValues: {
				":valid": results.valid,
				":invalid": results.invalid,
				":credits": results.creditsUsed,
			},
		})
	);
}

async function queueForSending(lead: Lead, campaignId: string): Promise<void> {
	if (!SENDING_QUEUE_URL) return;

	// Update lead status to VERIFIED
	await docClient.send(
		new UpdateCommand({
			TableName: LEADS_TABLE,
			Key: { id: lead.id },
			UpdateExpression: "SET #status = :status, updatedAt = :now",
			ExpressionAttributeNames: { "#status": "status" },
			ExpressionAttributeValues: {
				":status": "VERIFIED",
				":now": new Date().toISOString(),
			},
		})
	);

	// Queue to sending queue for the campaign processor to pick up
	// Note: The campaign processor will handle the actual sending with Gaussian delays
	await sqsClient.send(
		new SendMessageCommand({
			QueueUrl: SENDING_QUEUE_URL,
			MessageBody: JSON.stringify({
				leadId: lead.id,
				campaignId,
				email: lead.email,
				fullName: lead.fullName,
				companyName: lead.companyName,
				parsedFirstName: lead.parsedFirstName || "",
			}),
		})
	);
}

// =============================================================================
// Utility Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		body: JSON.stringify(body),
	};
}

// =============================================================================
// Unified Handler (routes based on event type)
// =============================================================================

export const handler = async (event: SQSEvent | APIGatewayProxyEvent) => {
	// Check if it's an SQS event
	if ("Records" in event && Array.isArray(event.Records)) {
		return sqsHandler(event as SQSEvent, {} as any, () => { });
	}

	// Otherwise treat as API Gateway event
	return apiHandler(event as APIGatewayProxyEvent, {} as any, () => { });
};
