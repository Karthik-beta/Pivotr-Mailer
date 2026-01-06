import type { CampaignStatusType } from "../constants/status.constants";

/**
 * Campaign Document Interface
 *
 * Represents a discrete sending batch with specific configuration.
 * Each campaign transitions through the finite state machine defined by CampaignStatus.
 */
export interface Campaign {
    /** Appwrite document ID (auto-generated) */
    $id: string;

    /** Document creation timestamp */
    $createdAt: string;

    /** Document last update timestamp */
    $updatedAt: string;

    /** Human-readable campaign name */
    name: string;

    /** Campaign lifecycle state */
    status: CampaignStatusType;

    /** Spintax-enabled subject line template */
    subjectTemplate: string;

    /** Spintax-enabled HTML/plain body template */
    bodyTemplate: string;

    /** Verified SES sender identity */
    senderEmail: string;

    /** Display name for From header */
    senderName: string;

    /** Count of leads at campaign creation */
    totalLeads: number;

    /** Successfully sent count */
    processedCount: number;

    /** Verification failure count */
    skippedCount: number;

    /** Processing error count */
    errorCount: number;

    /** Timestamp of last pause */
    pausedAt: string | null;

    /** Queue position to resume from */
    resumePosition: number | null;

    /** Gaussian lower bound (milliseconds) */
    minDelayMs: number;

    /** Gaussian upper bound (milliseconds) */
    maxDelayMs: number;

    /** Custom Gaussian mean (default: midpoint) */
    gaussianMean: number | null;

    /** Custom Gaussian standard deviation */
    gaussianStdDev: number | null;

    /** If true, RISKY (catch-all) leads are sent; if false, skipped */
    allowCatchAll: boolean;

    /** Timestamp of last state transition */
    lastActivityAt: string | null;

    /** Campaign completion timestamp */
    completedAt: string | null;
}

/**
 * Campaign Create Input
 *
 * Fields required when creating a new campaign.
 */
export interface CampaignCreateInput {
    name: string;
    subjectTemplate: string;
    bodyTemplate: string;
    senderEmail: string;
    senderName: string;
    totalLeads: number;
    minDelayMs: number;
    maxDelayMs: number;
    allowCatchAll?: boolean;
    gaussianMean?: number;
    gaussianStdDev?: number;
}

/**
 * Campaign Update Input
 *
 * Fields that can be updated on an existing campaign.
 */
export interface CampaignUpdateInput {
    name?: string;
    status?: CampaignStatusType;
    subjectTemplate?: string;
    bodyTemplate?: string;
    senderEmail?: string;
    senderName?: string;
    processedCount?: number;
    skippedCount?: number;
    errorCount?: number;
    pausedAt?: string | null;
    resumePosition?: number | null;
    minDelayMs?: number;
    maxDelayMs?: number;
    gaussianMean?: number | null;
    gaussianStdDev?: number | null;
    allowCatchAll?: boolean;
    lastActivityAt?: string | null;
    completedAt?: string | null;
}
