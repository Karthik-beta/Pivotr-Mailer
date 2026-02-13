/**
 * API Campaigns Lambda
 *
 * Handles Campaign CRUD operations with enhanced functionality:
 * - Full campaign lifecycle management (DRAFT → QUEUED → RUNNING → PAUSED → COMPLETED)
 * - Lead assignment by Type and Status filters
 * - Status transitions with validation
 * - Test email functionality
 * - Lead count preview
 *
 * Routes:
 * - GET /campaigns - List all campaigns
 * - GET /campaigns/{id} - Get single campaign
 * - GET /campaigns/{id}/leads - Get leads assigned to campaign
 * - GET /campaigns/{id}/metrics - Get campaign metrics
 * - POST /campaigns - Create new campaign
 * - POST /campaigns/{id}/assign-leads - Assign leads to campaign
 * - PUT /campaigns/{id}/status - Transition campaign status
 * - POST /campaigns/{id}/test-email - Send test email
 * - POST /campaigns/preview-leads - Preview leads matching criteria
 * - PUT /campaigns/{id} - Update campaign
 * - DELETE /campaigns/{id} - Delete campaign
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Handler,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	ScanCommand,
	GetCommand,
	PutCommand,
	UpdateCommand,
	DeleteCommand,
	QueryCommand,
	BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { z } from "zod";
import {
	CampaignCreateInputSchema,
	CampaignUpdateInputSchema,
	CampaignStatusSchema,
	isValidStatusTransition,
	TestEmailRequestSchema,
	LeadSelectionSchema,
	type Campaign,
	type CampaignStatus,
	type CampaignMetrics,
} from "../../../../shared/validation/campaign.schema";
import { resolveSpintax, injectVariables } from "../../../shared/src/utils/spintax";

// =============================================================================
// Configuration
// =============================================================================

const logger = new Logger({
	serviceName: "api-campaigns",
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

const sesClient = new SESClient(clientConfig);

const CAMPAIGNS_TABLE = process.env.DYNAMODB_TABLE_CAMPAIGNS || "";
const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || "";
const METRICS_TABLE = process.env.DYNAMODB_TABLE_METRICS || "";
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || "";
const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || "";

// =============================================================================
// Types
// =============================================================================

interface Lead {
	id: string;
	email: string;
	fullName: string;
	companyName: string;
	status: string;
	leadType?: string;
	campaignId?: string;
	parsedFirstName?: string;
}

// =============================================================================
// Response Helper
// =============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
		body: JSON.stringify(body),
	};
}

// =============================================================================
// Main Handler
// =============================================================================

export const handler: Handler<
	APIGatewayProxyEvent,
	APIGatewayProxyResult
> = async (event) => {
	const { httpMethod, path, pathParameters, body } = event;
	const id = pathParameters?.id;

	logger.info("Handling campaign request", { httpMethod, path, id });

	try {
		// GET /campaigns/{id}/leads
		if (httpMethod === "GET" && path.includes("/leads") && id) {
			return await getCampaignLeads(id, event);
		}

		// GET /campaigns/{id}/metrics
		if (httpMethod === "GET" && path.includes("/metrics") && id) {
			return await getCampaignMetrics(id);
		}

		// GET /campaigns or /campaigns/{id}
		if (httpMethod === "GET") {
			if (id) return await getCampaign(id);
			return await listCampaigns(event);
		}

		// POST /campaigns/{id}/assign-leads
		if (httpMethod === "POST" && path.includes("/assign-leads") && id) {
			return await assignLeadsToCampaign(id, body);
		}

		// PUT /campaigns/{id}/status
		if (httpMethod === "PUT" && path.includes("/status") && id) {
			return await transitionStatus(id, body);
		}

		// POST /campaigns/{id}/test-email
		if (httpMethod === "POST" && path.includes("/test-email") && id) {
			return await sendTestEmail(id, body);
		}

		// POST /campaigns/preview-leads
		if (httpMethod === "POST" && path.includes("/preview-leads")) {
			return await previewLeads(body);
		}

		// POST /campaigns
		if (httpMethod === "POST") {
			return await createCampaign(body);
		}

		// PUT /campaigns/{id}
		if (httpMethod === "PUT" && id) {
			return await updateCampaign(id, body);
		}

		// DELETE /campaigns/{id}
		if (httpMethod === "DELETE" && id) {
			return await deleteCampaign(id);
		}

		return response(405, { success: false, message: "Method Not Allowed" });
	} catch (error) {
		logger.error("Error handling request", { error });

		if (error instanceof z.ZodError) {
			return response(400, {
				success: false,
				message: "Validation error",
				errors: error.errors,
			});
		}

		return response(500, {
			success: false,
			message: error instanceof Error ? error.message : "Internal Server Error",
		});
	}
};

// =============================================================================
// List Campaigns
// =============================================================================

async function listCampaigns(
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
	const limit = parseInt(event.queryStringParameters?.limit ?? "50", 10);
	const statusFilter = event.queryStringParameters?.status;
	const lastKey = event.queryStringParameters?.lastKey;

	const scanParams: any = {
		TableName: CAMPAIGNS_TABLE,
		Limit: Math.min(limit, 100),
	};

	if (statusFilter) {
		scanParams.FilterExpression = "#status = :status";
		scanParams.ExpressionAttributeNames = { "#status": "status" };
		scanParams.ExpressionAttributeValues = { ":status": statusFilter };
	}

	if (lastKey) {
		scanParams.ExclusiveStartKey = JSON.parse(
			Buffer.from(lastKey, "base64").toString()
		);
	}

	const result = await docClient.send(new ScanCommand(scanParams));

	return response(200, {
		success: true,
		data: result.Items,
		count: result.Items?.length ?? 0,
		lastKey: result.LastEvaluatedKey
			? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
			: null,
	});
}

// =============================================================================
// Get Single Campaign
// =============================================================================

async function getCampaign(id: string): Promise<APIGatewayProxyResult> {
	const result = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
		})
	);

	if (!result.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	return response(200, { success: true, data: result.Item });
}

// =============================================================================
// Get Campaign Leads
// =============================================================================

async function getCampaignLeads(
	campaignId: string,
	event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
	const limit = parseInt(event.queryStringParameters?.limit ?? "50", 10);
	const statusFilter = event.queryStringParameters?.status;
	const lastKey = event.queryStringParameters?.lastKey;

	const queryParams: any = {
		TableName: LEADS_TABLE,
		IndexName: "CampaignIndex",
		KeyConditionExpression: "campaignId = :campaignId",
		ExpressionAttributeValues: { ":campaignId": campaignId },
		Limit: Math.min(limit, 100),
	};

	if (statusFilter) {
		queryParams.KeyConditionExpression += " AND #status = :status";
		queryParams.ExpressionAttributeNames = { "#status": "status" };
		queryParams.ExpressionAttributeValues[":status"] = statusFilter;
	}

	if (lastKey) {
		queryParams.ExclusiveStartKey = JSON.parse(
			Buffer.from(lastKey, "base64").toString()
		);
	}

	const result = await docClient.send(new QueryCommand(queryParams));

	return response(200, {
		success: true,
		data: result.Items,
		count: result.Items?.length ?? 0,
		lastKey: result.LastEvaluatedKey
			? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
			: null,
	});
}

// =============================================================================
// Get Campaign Metrics
// =============================================================================

async function getCampaignMetrics(
	campaignId: string
): Promise<APIGatewayProxyResult> {
	// First get campaign to verify it exists
	const campaignResult = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
		})
	);

	if (!campaignResult.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	// Get metrics from MetricsTable
	const metricsResult = await docClient.send(
		new GetCommand({
			TableName: METRICS_TABLE,
			Key: { pk: "CAMPAIGN", sk: campaignId },
		})
	);

	// Return campaign metrics (from campaign record + metrics table)
	const campaign = campaignResult.Item as Campaign;
	const metricsRecord = metricsResult.Item;

	const metrics: CampaignMetrics = {
		totalLeads: campaign.metrics?.totalLeads ?? 0,
		processedCount: campaign.metrics?.processedCount ?? 0,
		sentToday: metricsRecord?.sentToday ?? 0,
		sentCount: metricsRecord?.sentCount ?? campaign.metrics?.sentCount ?? 0,
		deliveredCount: metricsRecord?.deliveredCount ?? 0,
		bouncedCount: metricsRecord?.bouncedCount ?? 0,
		hardBounceCount: metricsRecord?.hardBounceCount ?? 0,
		softBounceCount: metricsRecord?.softBounceCount ?? 0,
		complainedCount: metricsRecord?.complainedCount ?? 0,
		openedCount: metricsRecord?.openedCount ?? 0,
		uniqueOpensCount: metricsRecord?.uniqueOpensCount ?? 0,
		clickedCount: metricsRecord?.clickedCount ?? 0,
		uniqueClicksCount: metricsRecord?.uniqueClicksCount ?? 0,
		unsubscribedCount: metricsRecord?.unsubscribedCount ?? 0,
		skippedCount: campaign.metrics?.skippedCount ?? 0,
		errorCount: campaign.metrics?.errorCount ?? 0,
		verificationPassedCount: metricsRecord?.verificationPassedCount ?? 0,
		verificationFailedCount: metricsRecord?.verificationFailedCount ?? 0,
	};

	return response(200, {
		success: true,
		data: {
			campaignId,
			campaignName: campaign.name,
			status: campaign.status,
			metrics,
		},
	});
}

// =============================================================================
// Create Campaign
// =============================================================================

async function createCampaign(
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	const data = JSON.parse(body);

	// Validate with Zod schema
	const validated = CampaignCreateInputSchema.parse(data);

	const now = new Date().toISOString();

	const campaign: Campaign = {
		id: crypto.randomUUID(),
		...validated,
		status: "DRAFT",
		metrics: {
			totalLeads: 0,
			processedCount: 0,
			sentToday: 0,
			sentCount: 0,
			deliveredCount: 0,
			bouncedCount: 0,
			hardBounceCount: 0,
			softBounceCount: 0,
			complainedCount: 0,
			openedCount: 0,
			uniqueOpensCount: 0,
			clickedCount: 0,
			uniqueClicksCount: 0,
			unsubscribedCount: 0,
			skippedCount: 0,
			errorCount: 0,
			verificationPassedCount: 0,
			verificationFailedCount: 0,
		},
		resumePosition: null,
		pausedAt: null,
		lastActivityAt: null,
		completedAt: null,
		createdAt: now,
		updatedAt: now,
	};

	await docClient.send(
		new PutCommand({
			TableName: CAMPAIGNS_TABLE,
			Item: campaign,
			ConditionExpression: "attribute_not_exists(id)",
		})
	);

	logger.info("Campaign created", { campaignId: campaign.id });

	return response(201, { success: true, data: campaign });
}

// =============================================================================
// Update Campaign
// =============================================================================

async function updateCampaign(
	id: string,
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	// Verify campaign exists and is in DRAFT status (can only edit drafts)
	const existing = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
		})
	);

	if (!existing.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	if (existing.Item.status !== "DRAFT") {
		return response(400, {
			success: false,
			message: "Can only edit campaigns in DRAFT status",
		});
	}

	const data = JSON.parse(body);
	const validated = CampaignUpdateInputSchema.parse(data);

	// Build dynamic update expression
	const updateParts: string[] = ["#updatedAt = :updatedAt"];
	const names: Record<string, string> = { "#updatedAt": "updatedAt" };
	const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };

	const allowedFields = [
		"name",
		"description",
		"template",
		"senderEmail",
		"senderName",
		"ccEmail",
		"leadSelection",
		"schedule",
		"delayConfig",
		"sendCriteria",
	];

	for (const key of allowedFields) {
		if ((validated as Record<string, unknown>)[key] !== undefined) {
			updateParts.push(`#${key} = :${key}`);
			names[`#${key}`] = key;
			values[`:${key}`] = (validated as Record<string, unknown>)[key];
		}
	}

	await docClient.send(
		new UpdateCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
			UpdateExpression: `SET ${updateParts.join(", ")}`,
			ExpressionAttributeNames: names,
			ExpressionAttributeValues: values,
		})
	);

	logger.info("Campaign updated", { campaignId: id });

	return response(200, { success: true, message: "Campaign updated" });
}

// =============================================================================
// Delete Campaign
// =============================================================================

async function deleteCampaign(id: string): Promise<APIGatewayProxyResult> {
	// Verify campaign exists and is deletable (DRAFT or ABORTED)
	const existing = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
		})
	);

	if (!existing.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	const status = existing.Item.status;
	if (!["DRAFT", "ABORTED", "COMPLETED", "ERROR"].includes(status)) {
		return response(400, {
			success: false,
			message: `Cannot delete campaign in ${status} status. Abort it first.`,
		});
	}

	await docClient.send(
		new DeleteCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
		})
	);

	logger.info("Campaign deleted", { campaignId: id });

	return response(200, { success: true, message: "Campaign deleted" });
}

// =============================================================================
// Preview Leads (count matching criteria without assigning)
// =============================================================================

async function previewLeads(
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	const data = JSON.parse(body);
	const criteria = LeadSelectionSchema.parse(data);

	// Build filter for leads
	const filterParts: string[] = [];
	const names: Record<string, string> = {};
	const values: Record<string, unknown> = {};

	// Status filter (only eligible statuses)
	const eligibleStatuses = criteria.leadStatuses.includes("ALL")
		? ["PENDING_IMPORT", "VERIFIED", "RISKY"]
		: criteria.leadStatuses;

	// Exclude already assigned leads (campaignId exists)
	filterParts.push("attribute_not_exists(campaignId)");

	// Exclude bounced, complained, unsubscribed
	filterParts.push("#status NOT IN (:bounced, :complained, :unsub)");
	names["#status"] = "status";
	values[":bounced"] = "BOUNCED";
	values[":complained"] = "COMPLAINED";
	values[":unsub"] = "UNSUBSCRIBED";

	// Status filter
	if (!criteria.leadStatuses.includes("ALL")) {
		const statusConditions = eligibleStatuses.map((s, i) => `:status${i}`);
		filterParts.push(`#status IN (${statusConditions.join(", ")})`);
		eligibleStatuses.forEach((s, i) => {
			values[`:status${i}`] = s;
		});
	}

	// Lead type filter
	if (!criteria.leadTypes.includes("ALL")) {
		names["#leadType"] = "leadType";
		const typeConditions = criteria.leadTypes.map((t, i) => `:type${i}`);
		filterParts.push(`#leadType IN (${typeConditions.join(", ")})`);
		criteria.leadTypes.forEach((t, i) => {
			values[`:type${i}`] = t;
		});
	}

	// Count leads matching criteria (scan with count)
	const result = await docClient.send(
		new ScanCommand({
			TableName: LEADS_TABLE,
			FilterExpression: filterParts.join(" AND "),
			ExpressionAttributeNames: names,
			ExpressionAttributeValues: values,
			Select: "COUNT",
		})
	);

	return response(200, {
		success: true,
		data: {
			matchingLeadsCount: result.Count ?? 0,
			criteria,
		},
	});
}

// =============================================================================
// Assign Leads to Campaign
// =============================================================================

async function assignLeadsToCampaign(
	campaignId: string,
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	// Verify campaign exists and is in DRAFT or QUEUED status
	const campaignResult = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
		})
	);

	if (!campaignResult.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	const campaign = campaignResult.Item as Campaign;
	if (!["DRAFT", "QUEUED"].includes(campaign.status)) {
		return response(400, {
			success: false,
			message: "Can only assign leads to DRAFT or QUEUED campaigns",
		});
	}

	const data = JSON.parse(body);
	const criteria = LeadSelectionSchema.parse(data);
	const maxLeads = data.maxLeads ?? 1000; // Limit batch size

	// Fetch leads matching criteria
	const leads = await fetchLeadsMatchingCriteria(criteria, maxLeads);

	if (leads.length === 0) {
		return response(200, {
			success: true,
			data: { assignedCount: 0, message: "No matching leads found" },
		});
	}

	// Batch update leads to assign to campaign
	const now = new Date().toISOString();
	const chunks = chunkArray(leads, 25); // DynamoDB batch limit
	let assignedCount = 0;

	for (const chunk of chunks) {
		const writeRequests = chunk.map((lead) => ({
			PutRequest: {
				Item: {
					...lead,
					campaignId,
					status: "QUEUED",
					updatedAt: now,
				},
			},
		}));

		try {
			await docClient.send(
				new BatchWriteCommand({
					RequestItems: {
						[LEADS_TABLE]: writeRequests,
					},
				})
			);
			assignedCount += chunk.length;
		} catch (err) {
			logger.error("Batch write failed", { error: err });
		}
	}

	// Update campaign metrics
	await docClient.send(
		new UpdateCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
			UpdateExpression:
				"SET #metrics.#totalLeads = :totalLeads, #updatedAt = :now",
			ExpressionAttributeNames: {
				"#metrics": "metrics",
				"#totalLeads": "totalLeads",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":totalLeads": (campaign.metrics?.totalLeads ?? 0) + assignedCount,
				":now": now,
			},
		})
	);

	logger.info("Leads assigned to campaign", { campaignId, assignedCount });

	return response(200, {
		success: true,
		data: { assignedCount, campaignId },
	});
}

async function fetchLeadsMatchingCriteria(
	criteria: z.infer<typeof LeadSelectionSchema>,
	limit: number
): Promise<Lead[]> {
	// Build filter expression
	const filterParts: string[] = [];
	const names: Record<string, string> = {};
	const values: Record<string, unknown> = {};

	// No existing campaign assignment
	filterParts.push("attribute_not_exists(campaignId)");

	// Status filter
	if (!criteria.leadStatuses.includes("ALL")) {
		names["#status"] = "status";
		const statusList = criteria.leadStatuses.filter((s) => s !== "ALL");
		const statusPlaceholders = statusList.map((_, i) => `:eligStatus${i}`);
		filterParts.push(`#status IN (${statusPlaceholders.join(", ")})`);
		statusList.forEach((s, i) => {
			values[`:eligStatus${i}`] = s;
		});
	}

	// Lead type filter
	if (!criteria.leadTypes.includes("ALL")) {
		names["#leadType"] = "leadType";
		const typeList = criteria.leadTypes.filter((t) => t !== "ALL");
		const typePlaceholders = typeList.map((_, i) => `:type${i}`);
		filterParts.push(`#leadType IN (${typePlaceholders.join(", ")})`);
		typeList.forEach((t, i) => {
			values[`:type${i}`] = t;
		});
	}

	const result = await docClient.send(
		new ScanCommand({
			TableName: LEADS_TABLE,
			FilterExpression:
				filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
			ExpressionAttributeNames:
				Object.keys(names).length > 0 ? names : undefined,
			ExpressionAttributeValues:
				Object.keys(values).length > 0 ? values : undefined,
			Limit: limit,
		})
	);

	return (result.Items ?? []) as Lead[];
}

// =============================================================================
// Transition Campaign Status
// =============================================================================

async function transitionStatus(
	id: string,
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	const data = JSON.parse(body);
	const targetStatus = CampaignStatusSchema.parse(data.status);

	// Get current campaign
	const result = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
		})
	);

	if (!result.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	const campaign = result.Item as Campaign;
	const currentStatus = campaign.status as CampaignStatus;

	// Validate transition
	if (!isValidStatusTransition(currentStatus, targetStatus)) {
		return response(400, {
			success: false,
			message: `Invalid transition: ${currentStatus} → ${targetStatus}`,
			allowedTransitions: getValidTransitions(currentStatus),
		});
	}

	// Additional validation for specific transitions (skip when resuming from PAUSED)
	if ((targetStatus === "QUEUED" || targetStatus === "RUNNING") && currentStatus !== "PAUSED") {
		// Must have template
		if (!campaign.template?.subject || !campaign.template?.body) {
			return response(400, {
				success: false,
				message: "Campaign must have a valid template before starting",
			});
		}

		// Must have leads assigned
		if ((campaign.metrics?.totalLeads ?? 0) === 0) {
			return response(400, {
				success: false,
				message: "Campaign must have leads assigned before starting",
			});
		}

		// Must have scheduled dates
		if (
			!campaign.schedule?.scheduledDates ||
			campaign.schedule.scheduledDates.length === 0
		) {
			return response(400, {
				success: false,
				message: "Campaign must have scheduled dates before starting",
			});
		}
	}

	const now = new Date().toISOString();
	const updateExpression = ["#status = :status", "#updatedAt = :now"];
	const expressionNames: Record<string, string> = {
		"#status": "status",
		"#updatedAt": "updatedAt",
	};
	const expressionValues: Record<string, unknown> = {
		":status": targetStatus,
		":now": now,
	};

	// Set additional fields based on transition
	if (targetStatus === "PAUSED") {
		updateExpression.push("#pausedAt = :pausedAt");
		expressionNames["#pausedAt"] = "pausedAt";
		expressionValues[":pausedAt"] = now;
	}

	if (targetStatus === "RUNNING" && currentStatus === "PAUSED") {
		// Resuming - clear pausedAt
		updateExpression.push("#pausedAt = :null");
		expressionNames["#pausedAt"] = "pausedAt";
		expressionValues[":null"] = null;
	}

	if (targetStatus === "COMPLETED") {
		updateExpression.push("#completedAt = :completedAt");
		expressionNames["#completedAt"] = "completedAt";
		expressionValues[":completedAt"] = now;
	}

	updateExpression.push("#lastActivityAt = :lastActivity");
	expressionNames["#lastActivityAt"] = "lastActivityAt";
	expressionValues[":lastActivity"] = now;

	await docClient.send(
		new UpdateCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id },
			UpdateExpression: `SET ${updateExpression.join(", ")}`,
			ExpressionAttributeNames: expressionNames,
			ExpressionAttributeValues: expressionValues,
		})
	);

	logger.info("Campaign status transitioned", {
		campaignId: id,
		from: currentStatus,
		to: targetStatus,
	});

	return response(200, {
		success: true,
		data: {
			campaignId: id,
			previousStatus: currentStatus,
			currentStatus: targetStatus,
		},
	});
}

function getValidTransitions(status: CampaignStatus): CampaignStatus[] {
	const transitions: Record<CampaignStatus, CampaignStatus[]> = {
		DRAFT: ["QUEUED", "ABORTED"],
		QUEUED: ["RUNNING", "PAUSED", "DRAFT", "ABORTED"],
		RUNNING: ["PAUSED", "ABORTING", "COMPLETED", "ERROR"],
		PAUSED: ["RUNNING", "DRAFT", "ABORTED"],
		ABORTING: ["ABORTED", "ERROR"],
		ABORTED: ["DRAFT"],
		COMPLETED: ["DRAFT"],
		ERROR: ["DRAFT", "ABORTED"],
	};
	return transitions[status] ?? [];
}

// =============================================================================
// Send Test Email
// =============================================================================

async function sendTestEmail(
	campaignId: string,
	body: string | null
): Promise<APIGatewayProxyResult> {
	if (!body) {
		return response(400, { success: false, message: "Request body required" });
	}

	const data = JSON.parse(body);
	const request = TestEmailRequestSchema.parse({
		campaignId,
		testEmail: data.testEmail,
		variableOverrides: data.variableOverrides,
	});

	// Get campaign
	const result = await docClient.send(
		new GetCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
		})
	);

	if (!result.Item) {
		return response(404, { success: false, message: "Campaign not found" });
	}

	const campaign = result.Item as Campaign;

	if (!campaign.template?.subject || !campaign.template?.body) {
		return response(400, {
			success: false,
			message: "Campaign template not configured",
		});
	}

	// Prepare test variables
	const testVariables = {
		firstName: request.variableOverrides.firstName ?? "John",
		fullName: request.variableOverrides.fullName ?? "John Doe",
		company: request.variableOverrides.company ?? "Acme Corp",
		email: request.testEmail,
		...request.variableOverrides,
	};

	// Resolve Spintax and inject variables
	const resolvedSubject = injectVariables(
		resolveSpintax(campaign.template.subject),
		testVariables
	);
	const resolvedBody = injectVariables(
		resolveSpintax(campaign.template.body),
		testVariables
	);

	// Send via SES
	try {
		const sesResponse = await sesClient.send(
			new SendEmailCommand({
				Source: `${campaign.senderName} <${campaign.senderEmail || SES_FROM_EMAIL}>`,
				Destination: { ToAddresses: [request.testEmail] },
				Message: {
					Subject: { Data: resolvedSubject, Charset: "UTF-8" },
					Body: { Html: { Data: resolvedBody, Charset: "UTF-8" } },
				},
				ConfigurationSetName: SES_CONFIGURATION_SET || undefined,
			})
		);

		logger.info("Test email sent", {
			campaignId,
			testEmail: request.testEmail,
			messageId: sesResponse.MessageId,
		});

		return response(200, {
			success: true,
			data: {
				messageId: sesResponse.MessageId,
				testEmail: request.testEmail,
				resolvedSubject,
				message: "Test email sent successfully",
			},
		});
	} catch (error) {
		logger.error("Failed to send test email", { error });
		return response(500, {
			success: false,
			message: `Failed to send test email: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}
}

// =============================================================================
// Utility Functions
// =============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}
	return result;
}
