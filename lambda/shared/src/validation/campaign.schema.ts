/**
 * Campaign Validation Schemas
 *
 * Zod schemas for Campaign Manager validation.
 * Used by both frontend and backend for type-safe validation.
 */

import { z } from "zod";

// =============================================================================
// Time and Schedule Schemas
// =============================================================================

/**
 * Time string in HH:MM format (24-hour)
 */
export const TimeStringSchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be in HH:MM format (24-hour)");

/**
 * Working hours configuration
 */
export const WorkingHoursSchema = z
	.object({
		/** Start of working window (e.g., "09:00") */
		start: TimeStringSchema,
		/** End of working window (e.g., "18:00") */
		end: TimeStringSchema,
	})
	.refine(
		(data) => {
			const [startH, startM] = data.start.split(":").map(Number);
			const [endH, endM] = data.end.split(":").map(Number);
			return startH * 60 + startM < endH * 60 + endM;
		},
		{ message: "End time must be after start time" }
	);

/**
 * Peak hours configuration (subset of working hours for maximum send volume)
 */
export const PeakHoursSchema = z
	.object({
		/** Start of peak window (e.g., "10:00") */
		start: TimeStringSchema,
		/** End of peak window (e.g., "14:00") */
		end: TimeStringSchema,
	})
	.refine(
		(data) => {
			const [startH, startM] = data.start.split(":").map(Number);
			const [endH, endM] = data.end.split(":").map(Number);
			return startH * 60 + startM < endH * 60 + endM;
		},
		{ message: "Peak end time must be after peak start time" }
	);

/**
 * Schedule configuration for campaign timing
 */
export const ScheduleConfigSchema = z.object({
	/** Working hours window */
	workingHours: WorkingHoursSchema,
	/** Peak hours for maximum send volume */
	peakHours: PeakHoursSchema,
	/** Timezone for scheduling (IANA format) */
	timezone: z.string().min(1, "Timezone required").default("Asia/Kolkata"),
	/** Specific dates approved for sending (ISO date strings YYYY-MM-DD) */
	scheduledDates: z
		.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"))
		.min(1, "At least one scheduled date required"),
	/** Maximum emails to send per day */
	dailyLimit: z.number().int().min(1).max(10000).default(500),
	/** Batch size per orchestrator cycle */
	batchSize: z.number().int().min(1).max(100).default(50),
});

export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;

// =============================================================================
// Delay Configuration Schemas
// =============================================================================

/**
 * Gaussian delay configuration for human-like timing
 */
export const DelayConfigSchema = z
	.object({
		/** Minimum delay between emails (milliseconds) */
		minDelayMs: z.number().int().min(1000).max(600000).default(30000), // 30s default
		/** Maximum delay between emails (milliseconds) */
		maxDelayMs: z.number().int().min(1000).max(600000).default(180000), // 3min default
		/** Custom Gaussian mean (optional, defaults to midpoint) */
		gaussianMean: z.number().int().optional(),
		/** Custom Gaussian standard deviation (optional) */
		gaussianStdDev: z.number().int().optional(),
	})
	.refine((data) => data.minDelayMs < data.maxDelayMs, {
		message: "maxDelayMs must be greater than minDelayMs",
	});

export type DelayConfig = z.infer<typeof DelayConfigSchema>;

// =============================================================================
// Template Schemas
// =============================================================================

/**
 * Validates Spintax syntax has balanced braces
 */
function hasBalancedSpintax(text: string): boolean {
	let depth = 0;
	for (const char of text) {
		if (char === "{") depth++;
		if (char === "}") depth--;
		if (depth < 0) return false;
	}
	return depth === 0;
}

/**
 * Email template with Spintax support
 */
export const TemplateSchema = z.object({
	/** Subject line with optional Spintax (e.g., "{Hi|Hello} {{FirstName}}") */
	subject: z
		.string()
		.min(1, "Subject required")
		.max(200, "Subject too long")
		.refine(hasBalancedSpintax, "Unbalanced Spintax braces in subject"),
	/** HTML body with optional Spintax and variables */
	body: z
		.string()
		.min(10, "Body too short")
		.max(100000, "Body too long")
		.refine(hasBalancedSpintax, "Unbalanced Spintax braces in body"),
});

export type Template = z.infer<typeof TemplateSchema>;

// =============================================================================
// Sending Criteria Schemas
// =============================================================================

/**
 * Risk tolerance settings for email verification statuses
 */
export const SendCriteriaSchema = z.object({
	/** Allow sending to catch-all domains */
	allowCatchAll: z.boolean().default(false),
	/** Allow sending to unknown verification status */
	allowUnknown: z.boolean().default(false),
	/** Allow sending to risky addresses (advanced override) */
	allowRisky: z.boolean().default(false),
});

export type SendCriteria = z.infer<typeof SendCriteriaSchema>;

// =============================================================================
// Lead Selection Schemas
// =============================================================================

/**
 * Lead type filter options
 */
export const LeadTypeFilterSchema = z.enum(["HARDWARE", "SOFTWARE", "BOTH", "ALL"]);

/**
 * Lead status filter options (eligible statuses for campaigns)
 */
export const LeadStatusFilterSchema = z.enum(["PENDING_IMPORT", "VERIFIED", "RISKY", "ALL"]);

/**
 * Lead selection criteria for campaign targeting
 */
export const LeadSelectionSchema = z.object({
	/** Filter by lead type */
	leadTypes: z.array(LeadTypeFilterSchema).min(1, "Select at least one lead type"),
	/** Filter by lead status */
	leadStatuses: z.array(LeadStatusFilterSchema).min(1, "Select at least one status"),
	/** Exclude specific lead IDs (bounced, complained, unsubscribed are auto-excluded) */
	excludeLeadIds: z.array(z.string().uuid()).optional(),
});

export type LeadSelection = z.infer<typeof LeadSelectionSchema>;

// =============================================================================
// Campaign Status Schema
// =============================================================================

export const CampaignStatusSchema = z.enum([
	"DRAFT",
	"QUEUED",
	"RUNNING",
	"PAUSED",
	"ABORTING",
	"ABORTED",
	"COMPLETED",
	"ERROR",
]);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

// =============================================================================
// Campaign Metrics Schema
// =============================================================================

export const CampaignMetricsSchema = z.object({
	/** Total leads assigned to campaign */
	totalLeads: z.number().int().default(0),
	/** Leads processed (sent or skipped) */
	processedCount: z.number().int().default(0),
	/** Successfully sent emails */
	sentCount: z.number().int().default(0),
	/** Emails sent today (resets daily) */
	sentToday: z.number().int().default(0),
	/** Last date when sentToday was updated (YYYY-MM-DD) */
	lastSentDate: z.string().optional(),
	/** Successfully delivered emails */
	deliveredCount: z.number().int().default(0),
	/** Total bounces (hard + soft) */
	bouncedCount: z.number().int().default(0),
	/** Hard bounces */
	hardBounceCount: z.number().int().default(0),
	/** Soft bounces */
	softBounceCount: z.number().int().default(0),
	/** Spam complaints */
	complainedCount: z.number().int().default(0),
	/** Email opens (requires tracking pixel) */
	openedCount: z.number().int().default(0),
	/** Unique opens */
	uniqueOpensCount: z.number().int().default(0),
	/** Link clicks */
	clickedCount: z.number().int().default(0),
	/** Unique clicks */
	uniqueClicksCount: z.number().int().default(0),
	/** Unsubscribes */
	unsubscribedCount: z.number().int().default(0),
	/** Skipped (verification failed, etc.) */
	skippedCount: z.number().int().default(0),
	/** Errors during processing */
	errorCount: z.number().int().default(0),
	/** Verification passed count */
	verificationPassedCount: z.number().int().default(0),
	/** Verification failed count */
	verificationFailedCount: z.number().int().default(0),
});

export type CampaignMetrics = z.infer<typeof CampaignMetricsSchema>;

// =============================================================================
// Full Campaign Schema
// =============================================================================

export const CampaignSchema = z.object({
	/** Unique campaign ID */
	id: z.string().uuid(),
	/** Human-readable campaign name */
	name: z.string().min(1, "Name required").max(100, "Name too long"),
	/** Optional description */
	description: z.string().max(500).optional(),
	/** Campaign lifecycle status */
	status: CampaignStatusSchema.default("DRAFT"),
	/** Email template configuration */
	template: TemplateSchema,
	/** Sender email (must be verified in SES) */
	senderEmail: z.string().email("Invalid sender email"),
	/** Sender display name */
	senderName: z.string().min(1, "Sender name required").max(100),
	/** Optional CC email for all campaign emails */
	ccEmail: z.string().email("Invalid CC email").optional(),
	/** Lead selection criteria */
	leadSelection: LeadSelectionSchema,
	/** Schedule configuration */
	schedule: ScheduleConfigSchema,
	/** Delay configuration for Gaussian timing */
	delayConfig: DelayConfigSchema,
	/** Sending criteria (risk tolerance) */
	sendCriteria: SendCriteriaSchema,
	/** Campaign metrics */
	metrics: CampaignMetricsSchema.optional(),
	/** Queue position to resume from (for pause/resume) */
	resumePosition: z.number().int().nullable().default(null),
	/** Timestamp of last pause */
	pausedAt: z.string().datetime().nullable().default(null),
	/** Timestamp of last activity */
	lastActivityAt: z.string().datetime().nullable().default(null),
	/** Timestamp of completion */
	completedAt: z.string().datetime().nullable().default(null),
	/** Document creation timestamp */
	createdAt: z.string().datetime(),
	/** Document last update timestamp */
	updatedAt: z.string().datetime(),
});

export type Campaign = z.infer<typeof CampaignSchema>;

// =============================================================================
// Campaign Create/Update Input Schemas
// =============================================================================

export const CampaignCreateInputSchema = CampaignSchema.omit({
	id: true,
	status: true,
	metrics: true,
	resumePosition: true,
	pausedAt: true,
	lastActivityAt: true,
	completedAt: true,
	createdAt: true,
	updatedAt: true,
});

export type CampaignCreateInput = z.infer<typeof CampaignCreateInputSchema>;

export const CampaignUpdateInputSchema = CampaignCreateInputSchema.partial();

export type CampaignUpdateInput = z.infer<typeof CampaignUpdateInputSchema>;

// =============================================================================
// Campaign Status Transition Validation
// =============================================================================

/**
 * Valid status transitions for campaign lifecycle
 */
export const VALID_STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
	DRAFT: ["QUEUED", "ABORTED"],
	QUEUED: ["RUNNING", "PAUSED", "DRAFT", "ABORTED"],
	RUNNING: ["PAUSED", "ABORTING", "COMPLETED", "ERROR"],
	PAUSED: ["RUNNING", "DRAFT", "ABORTED"],
	ABORTING: ["ABORTED", "ERROR"],
	ABORTED: ["DRAFT"], // Can restart as new draft
	COMPLETED: ["DRAFT"], // Can duplicate as new draft
	ERROR: ["DRAFT", "ABORTED"],
};

/**
 * Validates if a status transition is allowed
 */
export function isValidStatusTransition(from: CampaignStatus, to: CampaignStatus): boolean {
	return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Status transition request schema
 */
export const StatusTransitionSchema = z.object({
	campaignId: z.string().uuid(),
	targetStatus: CampaignStatusSchema,
});

export type StatusTransition = z.infer<typeof StatusTransitionSchema>;

// =============================================================================
// Test Email Schema
// =============================================================================

export const TestEmailRequestSchema = z.object({
	/** Campaign ID to use template from */
	campaignId: z.string().uuid(),
	/** Email address to send test to */
	testEmail: z.string().email("Invalid test email"),
	/** Optional variable overrides for preview */
	variableOverrides: z.record(z.string(), z.string()).optional().default({}),
});

export type TestEmailRequest = z.infer<typeof TestEmailRequestSchema>;