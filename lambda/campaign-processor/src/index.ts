/**
 * Campaign Processor Lambda (Orchestrator)
 *
 * The "heartbeat" of the campaign execution engine.
 * Triggered every minute by EventBridge to process RUNNING campaigns.
 *
 * Features:
 * - Gaussian time-of-day volume distribution (more emails during peak hours)
 * - Gaussian inter-email delay distribution (human-like variable timing)
 * - Respects scheduled dates (only processes on approved days)
 * - Respects working hours (no sends outside configured window)
 * - Handles pause/resume with position tracking
 * - Updates campaign metrics in real-time
 *
 * Flow:
 * 1. Query all RUNNING campaigns
 * 2. For each campaign:
 *    a. Check if today is a scheduled date
 *    b. Check if within working hours
 *    c. Calculate slot volume using Gaussian distribution
 *    d. Fetch batch of QUEUED leads (up to volume)
 *    e. Schedule emails with Gaussian delays to SQS
 *    f. Update lead statuses to SENDING
 *    g. Update campaign metrics
 */

import type { ScheduledHandler, ScheduledEvent } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	ScanCommand,
	QueryCommand,
	UpdateCommand,
	BatchWriteCommand,
	GetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
	SQSClient,
	SendMessageBatchCommand,
	type SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import {
	calculateSlotVolume,
	scheduleEmailBatch,
	isCampaignScheduledToday,
	getTodayInTimezone,
	type GaussianConfig,
} from "../../../shared/utils/gaussian";
import type { Campaign } from "../../../shared/validation/campaign.schema";

// =============================================================================
// Configuration
// =============================================================================

const logger = new Logger({
	serviceName: "campaign-processor",
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

const CAMPAIGNS_TABLE = process.env.DYNAMODB_TABLE_CAMPAIGNS || "";
const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || "";
const SENDING_QUEUE_URL = process.env.SQS_SENDING_QUEUE_URL || "";
const VERIFICATION_QUEUE_URL = process.env.SQS_VERIFICATION_QUEUE_URL || "";

// Processing constants
const SLOT_MINUTES = 1; // How often this Lambda runs
const MAX_BATCH_PER_CAMPAIGN = 100; // Safety limit per invocation

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
	parsedFirstName?: string;
}

interface ProcessingResult {
	campaignId: string;
	campaignName: string;
	leadsProcessed: number;
	leadsSkipped: number;
	reason?: string;
}

interface SendQueueMessage {
	leadId: string;
	campaignId: string;
	email: string;
	fullName: string;
	companyName: string;
	subjectTemplate: string;
	bodyTemplate: string;
	senderEmail: string;
	senderName: string;
	ccEmail?: string;
}

// =============================================================================
// Main Handler
// =============================================================================

export const handler: ScheduledHandler = async (event: ScheduledEvent) => {
	const startTime = Date.now();
	logger.info("Campaign processor started", { eventTime: event.time });

	const results: ProcessingResult[] = [];

	try {
		// 1. Get all RUNNING campaigns
		const campaigns = await getRunningCampaigns();
		logger.info("Found running campaigns", { count: campaigns.length });

		if (campaigns.length === 0) {
			logger.info("No running campaigns to process");
			return;
		}

		// 2. Process each campaign
		for (const campaign of campaigns) {
			try {
				const result = await processCampaign(campaign);
				results.push(result);
			} catch (error) {
				logger.error("Failed to process campaign", {
					campaignId: campaign.id,
					error: error instanceof Error ? error.message : String(error),
				});
				results.push({
					campaignId: campaign.id,
					campaignName: campaign.name,
					leadsProcessed: 0,
					leadsSkipped: 0,
					reason: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
				});
			}
		}

		const duration = Date.now() - startTime;
		logger.info("Campaign processor completed", {
			duration,
			campaignsProcessed: campaigns.length,
			results,
		});
	} catch (error) {
		logger.error("Campaign processor failed", { error });
		throw error;
	}
};

// =============================================================================
// Get Running Campaigns
// =============================================================================

async function getRunningCampaigns(): Promise<Campaign[]> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: CAMPAIGNS_TABLE,
			FilterExpression: "#status = :status",
			ExpressionAttributeNames: { "#status": "status" },
			ExpressionAttributeValues: { ":status": "RUNNING" },
		})
	);

	return (result.Items ?? []) as Campaign[];
}

// =============================================================================
// Process Single Campaign
// =============================================================================

async function processCampaign(campaign: Campaign): Promise<ProcessingResult> {
	const result: ProcessingResult = {
		campaignId: campaign.id,
		campaignName: campaign.name,
		leadsProcessed: 0,
		leadsSkipped: 0,
	};

	// 1. Check if today is a scheduled date
	if (!campaign.schedule?.scheduledDates?.length) {
		result.reason = "No scheduled dates configured";
		return result;
	}

	const timezone = campaign.schedule.timezone || "Asia/Kolkata";
	const today = getTodayInTimezone(timezone);

	if (!isCampaignScheduledToday(campaign.schedule.scheduledDates, timezone)) {
		result.reason = `Today (${today}) not in scheduled dates`;
		logger.debug("Campaign not scheduled for today", {
			campaignId: campaign.id,
			today,
			scheduledDates: campaign.schedule.scheduledDates,
		});
		return result;
	}

	// 2. Build Gaussian config from campaign settings
	const gaussianConfig: GaussianConfig = {
		workingHours: campaign.schedule.workingHours || { start: "09:00", end: "18:00" },
		peakHours: campaign.schedule.peakHours || { start: "10:00", end: "14:00" },
		timezone,
		minDelayMs: campaign.delayConfig?.minDelayMs || 30000,
		maxDelayMs: campaign.delayConfig?.maxDelayMs || 180000,
		gaussianMean: campaign.delayConfig?.gaussianMean,
		gaussianStdDev: campaign.delayConfig?.gaussianStdDev,
		dailyLimit: campaign.schedule.dailyLimit || 500,
	};

	// 3. Calculate how many emails to send in this slot
	const remaining = getRemainingQuota(campaign);
	const slotResult = calculateSlotVolume(
		gaussianConfig,
		new Date(),
		SLOT_MINUTES,
		remaining
	);

	logger.debug("Slot volume calculated", {
		campaignId: campaign.id,
		...slotResult,
		remaining,
	});

	// Check if outside working hours
	if (!slotResult.inWorkingHours) {
		result.reason = `Outside working hours (${slotResult.minutesUntilWorkStart}m until start)`;
		return result;
	}

	// Check if volume is 0 (edge of bell curve or quota exhausted)
	if (slotResult.volume === 0) {
		result.reason = "Slot volume is 0 (low probability time or quota exhausted)";
		return result;
	}

	// Limit to batch size
	const batchSize = Math.min(
		slotResult.volume,
		campaign.schedule.batchSize || 50,
		MAX_BATCH_PER_CAMPAIGN
	);

	// 4. Fetch QUEUED leads for this campaign
	const leads = await getQueuedLeads(campaign.id, batchSize);

	if (leads.length === 0) {
		// No more leads to process - check if campaign should complete
		const allProcessed = await checkCampaignCompletion(campaign);
		if (allProcessed) {
			await transitionCampaignToCompleted(campaign.id);
			result.reason = "Campaign completed - all leads processed";
		} else {
			result.reason = "No queued leads available";
		}
		return result;
	}

	logger.info("Processing leads batch", {
		campaignId: campaign.id,
		batchSize: leads.length,
	});

	// 5. Separate leads by verification status
	const { needsVerification, readyToSend } = categorizeLeads(leads, campaign);

	// 6. Queue leads for verification if needed
	if (needsVerification.length > 0) {
		await queueForVerification(needsVerification, campaign);
		result.leadsProcessed += needsVerification.length;
	}

	// 7. Schedule verified leads for sending with Gaussian delays
	if (readyToSend.length > 0) {
		const scheduled = scheduleEmailBatch(
			readyToSend.map((l) => l.id),
			campaign.id,
			gaussianConfig
		);

		await queueForSending(readyToSend, campaign, scheduled);
		result.leadsProcessed += readyToSend.length;
	}

	// 8. Update campaign metrics
	await updateCampaignProgress(campaign.id, result.leadsProcessed);

	return result;
}

// =============================================================================
// Get Queued Leads for Campaign
// =============================================================================

async function getQueuedLeads(campaignId: string, limit: number): Promise<Lead[]> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: LEADS_TABLE,
			IndexName: "CampaignIndex",
			KeyConditionExpression: "campaignId = :campaignId AND #status = :status",
			ExpressionAttributeNames: { "#status": "status" },
			ExpressionAttributeValues: {
				":campaignId": campaignId,
				":status": "QUEUED",
			},
			Limit: limit,
		})
	);

	return (result.Items ?? []) as Lead[];
}

// =============================================================================
// Categorize Leads by Verification Status
// =============================================================================

function categorizeLeads(
	leads: Lead[],
	campaign: Campaign
): { needsVerification: Lead[]; readyToSend: Lead[] } {
	const needsVerification: Lead[] = [];
	const readyToSend: Lead[] = [];

	for (const lead of leads) {
		const verificationStatus = lead.verificationStatus;

		// Already verified as valid
		if (verificationStatus === "ok" || verificationStatus === "VERIFIED") {
			readyToSend.push(lead);
			continue;
		}

		// Catch-all depends on campaign settings
		if (verificationStatus === "catch_all" || verificationStatus === "RISKY") {
			if (campaign.sendCriteria?.allowCatchAll) {
				readyToSend.push(lead);
			}
			// else skip (already counted as skipped)
			continue;
		}

		// Unknown depends on settings
		if (verificationStatus === "unknown") {
			if (campaign.sendCriteria?.allowUnknown) {
				readyToSend.push(lead);
			}
			continue;
		}

		// Invalid statuses - skip
		if (["invalid", "spamtrap", "disposable", "INVALID"].includes(verificationStatus || "")) {
			continue;
		}

		// No verification status - needs verification
		if (!verificationStatus) {
			needsVerification.push(lead);
			continue;
		}

		// Default: needs verification
		needsVerification.push(lead);
	}

	return { needsVerification, readyToSend };
}

// =============================================================================
// Queue Leads for Verification
// =============================================================================

async function queueForVerification(leads: Lead[], campaign: Campaign): Promise<void> {
	if (!VERIFICATION_QUEUE_URL) {
		logger.warn("Verification queue URL not configured, skipping verification");
		return;
	}

	// Update leads to VERIFYING status
	await updateLeadsStatus(leads, "VERIFYING");

	// Send to verification queue in batches of 10 (SQS limit)
	const chunks = chunkArray(leads, 10);

	for (const chunk of chunks) {
		const entries: SendMessageBatchRequestEntry[] = chunk.map((lead, index) => ({
			Id: `${index}`,
			MessageBody: JSON.stringify({
				leadId: lead.id,
				campaignId: campaign.id,
				email: lead.email,
				fullName: lead.fullName,
				companyName: lead.companyName,
			}),
		}));

		await sqsClient.send(
			new SendMessageBatchCommand({
				QueueUrl: VERIFICATION_QUEUE_URL,
				Entries: entries,
			})
		);
	}

	logger.info("Queued leads for verification", {
		campaignId: campaign.id,
		count: leads.length,
	});
}

// =============================================================================
// Queue Leads for Sending with Gaussian Delays
// =============================================================================

async function queueForSending(
	leads: Lead[],
	campaign: Campaign,
	scheduled: Array<{ leadId: string; delaySeconds: number }>
): Promise<void> {
	if (!SENDING_QUEUE_URL) {
		logger.error("Sending queue URL not configured");
		return;
	}

	// Update leads to SENDING status
	await updateLeadsStatus(leads, "SENDING");

	// Create delay map
	const delayMap = new Map(scheduled.map((s) => [s.leadId, s.delaySeconds]));

	// Send to sending queue in batches of 10 (SQS limit)
	const chunks = chunkArray(leads, 10);

	for (const chunk of chunks) {
		const entries: SendMessageBatchRequestEntry[] = chunk.map((lead, index) => {
			const message: SendQueueMessage = {
				leadId: lead.id,
				campaignId: campaign.id,
				email: lead.email,
				fullName: lead.fullName,
				companyName: lead.companyName,
				subjectTemplate: campaign.template.subject,
				bodyTemplate: campaign.template.body,
				senderEmail: campaign.senderEmail,
				senderName: campaign.senderName,
				ccEmail: campaign.ccEmail,
			};

			return {
				Id: `${index}`,
				MessageBody: JSON.stringify(message),
				// Apply Gaussian delay (0-900 seconds for SQS)
				DelaySeconds: Math.min(delayMap.get(lead.id) || 0, 900),
			};
		});

		await sqsClient.send(
			new SendMessageBatchCommand({
				QueueUrl: SENDING_QUEUE_URL,
				Entries: entries,
			})
		);
	}

	logger.info("Queued leads for sending", {
		campaignId: campaign.id,
		count: leads.length,
	});
}

// =============================================================================
// Update Leads Status
// =============================================================================

async function updateLeadsStatus(leads: Lead[], status: string): Promise<void> {
	const now = new Date().toISOString();

	// Use UpdateCommand instead of BatchWriteCommand with PutRequest
	// to avoid overwriting fields not in our Lead interface
	for (const lead of leads) {
		await docClient.send(
			new UpdateCommand({
				TableName: LEADS_TABLE,
				Key: { id: lead.id },
				UpdateExpression: "SET #status = :status, #updatedAt = :now",
				ExpressionAttributeNames: {
					"#status": "status",
					"#updatedAt": "updatedAt",
				},
				ExpressionAttributeValues: {
					":status": status,
					":now": now,
				},
			})
		);
	}
}

// =============================================================================
// Update Campaign Progress
// =============================================================================

async function updateCampaignProgress(
	campaignId: string,
	processedCount: number
): Promise<void> {
	const now = new Date().toISOString();

	await docClient.send(
		new UpdateCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
			UpdateExpression:
				"SET #metrics.#processedCount = #metrics.#processedCount + :inc, #lastActivityAt = :now, #updatedAt = :now",
			ExpressionAttributeNames: {
				"#metrics": "metrics",
				"#processedCount": "processedCount",
				"#lastActivityAt": "lastActivityAt",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":inc": processedCount,
				":now": now,
			},
		})
	);
}

// =============================================================================
// Check Campaign Completion
// =============================================================================

async function checkCampaignCompletion(campaign: Campaign): Promise<boolean> {
	// Check if there are any leads still in QUEUED, VERIFYING, or SENDING status
	const result = await docClient.send(
		new QueryCommand({
			TableName: LEADS_TABLE,
			IndexName: "CampaignIndex",
			KeyConditionExpression: "campaignId = :campaignId",
			FilterExpression: "#status IN (:queued, :verifying, :sending)",
			ExpressionAttributeNames: { "#status": "status" },
			ExpressionAttributeValues: {
				":campaignId": campaign.id,
				":queued": "QUEUED",
				":verifying": "VERIFYING",
				":sending": "SENDING",
			},
			Select: "COUNT",
		})
	);

	return (result.Count ?? 0) === 0;
}

// =============================================================================
// Transition Campaign to Completed
// =============================================================================

async function transitionCampaignToCompleted(campaignId: string): Promise<void> {
	const now = new Date().toISOString();

	await docClient.send(
		new UpdateCommand({
			TableName: CAMPAIGNS_TABLE,
			Key: { id: campaignId },
			UpdateExpression:
				"SET #status = :status, #completedAt = :now, #lastActivityAt = :now, #updatedAt = :now",
			ExpressionAttributeNames: {
				"#status": "status",
				"#completedAt": "completedAt",
				"#lastActivityAt": "lastActivityAt",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":status": "COMPLETED",
				":now": now,
			},
		})
	);

	logger.info("Campaign completed", { campaignId });
}

// =============================================================================
// Utility Functions
// =============================================================================

function getRemainingQuota(campaign: Campaign): number {
	const dailyLimit = campaign.schedule?.dailyLimit || 500;

	// Get today's date in the campaign's timezone
	const timezone = campaign.schedule?.timezone || "Asia/Kolkata";
	const today = getTodayInTimezone(timezone);

	// Check if we have a daily metric for today
	// Fall back to using lastResetDate if sentToday isn't tracked properly
	const lastResetDate = campaign.metrics?.lastSentDate;
	const sentToday = campaign.metrics?.sentToday || 0;

	// If last reset date is not today, the sentToday counter should be 0
	if (lastResetDate !== today) {
		// Counter was from a previous day, treat as 0 sent today
		return dailyLimit;
	}

	return Math.max(0, dailyLimit - sentToday);
}

function chunkArray<T>(array: T[], size: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		result.push(array.slice(i, i + size));
	}
	return result;
}
