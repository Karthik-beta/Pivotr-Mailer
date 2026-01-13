/**
 * Campaign Form Schema
 *
 * Zod schemas for TanStack Form validation.
 * Replaces manual validation in campaignValidation.ts
 */

import { z } from "zod";

// Social Link Schema
export const socialLinkSchema = z.object({
	platform: z.enum(["linkedin", "twitter", "website", "email", "phone"]),
	url: z.string().min(1, "URL is required"),
	label: z.string().optional(),
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

// Sign-off Media Schema
export const signOffMediaSchema = z.object({
	type: z.enum(["image", "gif", "logo"]),
	url: z.string().min(1, "URL is required"),
	alt: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	link: z.string().optional(),
});

export type SignOffMedia = z.infer<typeof signOffMediaSchema>;

// Sign-off Config Schema
export const signOffConfigSchema = z.object({
	enabled: z.boolean(),
	content: z.string(),
	media: z.array(signOffMediaSchema).optional(),
	socialLinks: z.array(socialLinkSchema).optional(),
});

// Template Schema
export const templateSchema = z.object({
	subject: z.string().min(1, "Subject is required"),
	body: z.string().min(1, "Email body is required"),
	senderName: z.string().min(1, "Sender name is required"),
	senderEmail: z
		.string()
		.min(1, "Sender email is required")
		.email("Invalid email address"),
	ccEmail: z.string().email("Invalid CC email address").optional().or(z.literal("")),
	signOff: signOffConfigSchema.optional(),
});

// Working Hours Schema
export const workingHoursSchema = z.object({
	startHour: z.number().min(0).max(23),
	startMinute: z.number().min(0).max(59),
	endHour: z.number().min(0).max(23),
	endMinute: z.number().min(0).max(59),
});

// Peak Hours Schema
export const peakHoursSchema = z.object({
	startHour: z.number().min(0).max(23),
	endHour: z.number().min(0).max(23),
	peakMultiplier: z.number().positive(),
});

// Schedule Schema
export const scheduleSchema = z.object({
	workingHours: workingHoursSchema,
	peakHours: peakHoursSchema,
	timezone: z.string().min(1, "Timezone is required"),
	scheduledDates: z.array(z.date()).min(1, "Select at least one date"),
	dailyLimit: z.number().positive("Daily limit must be positive"),
	batchSize: z.number().positive("Batch size must be positive"),
});

// Delay Config Schema
export const delayConfigSchema = z
	.object({
		minDelayMs: z.number().min(5000, "Minimum delay must be at least 5 seconds"),
		maxDelayMs: z.number().max(600000, "Maximum delay cannot exceed 10 minutes"),
		gaussianEnabled: z.boolean(),
	})
	.refine((data) => data.minDelayMs < data.maxDelayMs, {
		message: "Min delay must be less than max delay",
		path: ["minDelayMs"],
	});

// Lead Type
export const leadTypeSchema = z.enum(["HARDWARE", "SOFTWARE", "BOTH"]);

// Lead Selection Schema
export const leadSelectionSchema = z.object({
	leadTypes: z.array(leadTypeSchema).min(1, "Select at least one lead type"),
	leadStatuses: z.array(z.string()).min(1, "Select at least one status"),
	maxLeads: z.number().positive().optional(),
});

// Full Campaign Form Schema
export const campaignFormSchema = z.object({
	name: z.string().min(1, "Campaign name is required"),
	description: z.string().optional(),
	template: templateSchema,
	schedule: scheduleSchema,
	delayConfig: delayConfigSchema,
	leadSelection: leadSelectionSchema,
});

export type CampaignFormData = z.infer<typeof campaignFormSchema>;

// Step-specific schemas for per-step validation
export const stepSchemas = {
	// Step 0: Basic Info
	basic: z.object({
		name: z.string().min(1, "Campaign name is required"),
		description: z.string().optional(),
	}),

	// Step 1: Template
	template: templateSchema,

	// Step 2: Schedule
	schedule: scheduleSchema,

	// Step 3: Delay
	delayConfig: delayConfigSchema,

	// Step 4: Lead Selection
	leadSelection: leadSelectionSchema,
} as const;

// Default form values
export const getDefaultFormValues = (): CampaignFormData => ({
	name: "",
	description: "",
	template: {
		subject: "",
		body: "",
		senderName: "",
		senderEmail: "",
		ccEmail: "",
		signOff: {
			enabled: false,
			content: "",
			media: [],
			socialLinks: [],
		},
	},
	schedule: {
		workingHours: {
			startHour: 9,
			startMinute: 0,
			endHour: 18,
			endMinute: 0,
		},
		peakHours: {
			startHour: 10,
			endHour: 14,
			peakMultiplier: 1.5,
		},
		timezone: "Asia/Kolkata",
		scheduledDates: [],
		dailyLimit: 500,
		batchSize: 50,
	},
	delayConfig: {
		minDelayMs: 30000,
		maxDelayMs: 180000,
		gaussianEnabled: true,
	},
	leadSelection: {
		leadTypes: [],
		leadStatuses: [],
	},
});
