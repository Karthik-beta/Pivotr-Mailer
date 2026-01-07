/**
 * Metrics Type Definitions
 */

import type { Models } from 'node-appwrite';
import type { MetricsScopeValue } from '../constants/status.constants';

/**
 * Metrics Document Structure
 */
export interface Metrics extends Models.Document {
    scope: MetricsScopeValue;
    scopeId: string; // 'global' or campaignId
    lastUpdatedAt: string;

    // Counters
    totalLeadsImported: number;
    totalEmailsSent: number;
    totalBounces: number;
    totalHardBounces: number;
    totalSoftBounces: number;
    totalComplaints: number;

    // Delivery/Tracking Metrics (from SES events)
    totalDelivered: number;
    totalOpens: number;
    totalClicks: number;
    totalRejected: number;
    totalDelayed: number;

    // Verification Metrics
    totalVerificationPassed: number;
    totalVerificationFailed: number;

    // Pipeline Metrics
    totalSkipped: number;
    totalErrors: number;

    // Usage Metrics
    verifierCreditsUsed: number;
}

/**
 * Input for incrementing metrics (delta values)
 */
export interface MetricsIncrementInput {
    totalLeadsImported?: number;
    totalEmailsSent?: number;
    totalBounces?: number;
    totalHardBounces?: number;
    totalSoftBounces?: number;
    totalComplaints?: number;
    // New SES event metrics
    totalDelivered?: number;
    totalOpens?: number;
    totalClicks?: number;
    totalRejected?: number;
    totalDelayed?: number;
    // Verification metrics
    totalVerificationPassed?: number;
    totalVerificationFailed?: number;
    totalSkipped?: number;
    totalErrors?: number;
    verifierCreditsUsed?: number;
}
