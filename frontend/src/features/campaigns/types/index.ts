/**
 * Campaign Types
 *
 * TypeScript types for the campaigns feature.
 */

// Campaign Status
export type CampaignStatus =
	| "DRAFT"
	| "QUEUED"
	| "RUNNING"
	| "PAUSED"
	| "ABORTING"
	| "ABORTED"
	| "COMPLETED"
	| "ERROR";

// Lead Type
export type LeadType = "HARDWARE" | "SOFTWARE" | "BOTH";

// Working Hours Configuration
export interface WorkingHours {
	start: string; // HH:MM
	end: string; // HH:MM
}

// Peak Hours Configuration
export interface PeakHours {
	start: string; // HH:MM
	end: string; // HH:MM
}

// Schedule Configuration
export interface ScheduleConfig {
	workingHours: WorkingHours;
	peakHours: PeakHours;
	timezone: string;
	scheduledDates: string[];
	dailyLimit: number;
	batchSize: number;
}

// Delay Configuration
export interface DelayConfig {
	minDelayMs: number;
	maxDelayMs: number;
	gaussianEnabled: boolean;
}

// Sign-off Image/Media
export interface SignOffMedia {
	type: "image" | "gif" | "logo";
	url: string;
	alt?: string;
	width?: number;
	height?: number;
	link?: string;
}

// Sign-off Configuration
export interface SignOffConfig {
	enabled: boolean;
	content: string; // Markdown content
	media?: SignOffMedia[];
	socialLinks?: Array<{
		platform: "linkedin" | "twitter" | "website" | "email" | "phone";
		url: string;
		label?: string;
	}>;
}

// Email Template
export interface EmailTemplate {
	subject: string;
	body: string;
	senderName: string;
	senderEmail: string;
	ccEmail?: string;
	signOff?: SignOffConfig;
}

// Lead Selection Criteria
export interface LeadSelection {
	leadTypes: LeadType[];
	leadStatuses: string[];
	maxLeads?: number;
}

// Campaign Metrics
export interface CampaignMetrics {
	totalLeads: number;
	verified: number;
	sent: number;
	delivered: number;
	opened: number;
	clicked: number;
	bounced: number;
	complained: number;
	failed: number;
	remaining: number;
}

// Campaign Interface
export interface Campaign {
	id: string;
	name: string;
	description?: string;
	status: CampaignStatus;
	template: EmailTemplate;
	schedule: ScheduleConfig;
	delayConfig: DelayConfig;
	leadSelection: LeadSelection;
	metrics?: CampaignMetrics;
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	completedAt?: string;
	pausedAt?: string;
	currentPosition?: number;
}

// API Response Types
export interface CampaignsResponse {
	success: boolean;
	data: Campaign[];
	pagination?: {
		limit: number;
		lastKey?: string;
	};
}

export interface CampaignResponse {
	success: boolean;
	data: Campaign;
}

export interface CreateCampaignRequest {
	name: string;
	description?: string;
	template: EmailTemplate;
	schedule: ScheduleConfig;
	delayConfig: DelayConfig;
	leadSelection: LeadSelection;
}

export interface UpdateCampaignRequest {
	name?: string;
	description?: string;
	template?: Partial<EmailTemplate>;
	schedule?: Partial<ScheduleConfig>;
	delayConfig?: Partial<DelayConfig>;
	leadSelection?: Partial<LeadSelection>;
}

export interface StatusChangeRequest {
	status: CampaignStatus;
}

export interface TestEmailRequest {
	recipientEmail: string;
}

export interface TestEmailResponse {
	success: boolean;
	message: string;
	messageId?: string;
}

export interface LeadPreviewRequest {
	leadTypes: LeadType[];
	leadStatuses: string[];
	maxLeads?: number;
}

export interface LeadPreviewResponse {
	success: boolean;
	data: {
		count: number;
		sample: Array<{
			id: string;
			email: string;
			fullName: string;
			companyName: string;
			status: string;
			type: string;
		}>;
	};
}

export interface AssignLeadsRequest {
	leadTypes: LeadType[];
	leadStatuses: string[];
	maxLeads?: number;
}

export interface AssignLeadsResponse {
	success: boolean;
	data: {
		assignedCount: number;
		message: string;
	};
}

export interface CampaignMetricsResponse {
	success: boolean;
	data: CampaignMetrics;
}
