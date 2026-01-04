import type { MetricsScopeType } from '../constants/status.constants';

/**
 * Metrics Document Interface
 * 
 * Pre-aggregated statistics for dashboard consumption.
 * Updated atomically via increment operations, NEVER via full table scans.
 */
export interface Metrics {
    /** Appwrite document ID */
    $id: string;

    /** Document creation timestamp */
    $createdAt: string;

    /** Document last update timestamp */
    $updatedAt: string;

    /** GLOBAL or CAMPAIGN scoped metrics */
    scope: MetricsScopeType;

    /** Campaign ID if scope=CAMPAIGN, null for GLOBAL */
    scopeId: string | null;

    /** Cumulative leads in system */
    totalLeadsImported: number;

    /** Successfully transmitted emails */
    totalEmailsSent: number;

    /** Total bounces (hard + soft) */
    totalBounces: number;

    /** Permanent delivery failures */
    totalHardBounces: number;

    /** Temporary delivery failures */
    totalSoftBounces: number;

    /** Spam/abuse reports */
    totalComplaints: number;

    /** Valid email addresses verified */
    totalVerificationPassed: number;

    /** Invalid/risky emails detected */
    totalVerificationFailed: number;

    /** Processing skips */
    totalSkipped: number;

    /** System errors */
    totalErrors: number;

    /** MyEmailVerifier API calls consumed */
    verifierCreditsUsed: number;

    /** Last metric update timestamp */
    lastUpdatedAt: string;
}

/**
 * Metrics Increment Input
 * 
 * Fields to increment on the metrics document.
 * All values are positive integers to add to current values.
 */
export interface MetricsIncrementInput {
    totalLeadsImported?: number;
    totalEmailsSent?: number;
    totalBounces?: number;
    totalHardBounces?: number;
    totalSoftBounces?: number;
    totalComplaints?: number;
    totalVerificationPassed?: number;
    totalVerificationFailed?: number;
    totalSkipped?: number;
    totalErrors?: number;
    verifierCreditsUsed?: number;
}

/**
 * Metrics Create Input
 * 
 * Fields required when creating a new metrics document.
 */
export interface MetricsCreateInput {
    scope: MetricsScopeType;
    scopeId?: string;
}
