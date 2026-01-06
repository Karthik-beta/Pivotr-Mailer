/**
 * Metrics Repository
 *
 * Data access layer for pre-aggregated metrics.
 * Metrics are updated synchronously within the orchestrator
 * (NOT via async event triggers) to prevent drift.
 */

import type { Client, Models } from 'node-appwrite';
import { Databases, Query } from 'node-appwrite';
import {
    CollectionId,
    DATABASE_ID,
    GLOBAL_METRICS_ID,
} from '../../constants/collection.constants';
import { MetricsScope } from '../../constants/status.constants';
import type { Metrics, MetricsIncrementInput } from '../../types/metrics.types';

/**
 * Convert Appwrite document to Metrics type
 */
function documentToMetrics(doc: Models.Document): Metrics {
    return doc as unknown as Metrics;
}

/**
 * Get global metrics
 */
export async function getGlobalMetrics(client: Client): Promise<Metrics | null> {
    const databases = new Databases(client);

    try {
        const doc = await databases.getDocument(DATABASE_ID, CollectionId.METRICS, GLOBAL_METRICS_ID);
        return documentToMetrics(doc);
    } catch {
        return null;
    }
}

/**
 * Get campaign-specific metrics
 */
export async function getCampaignMetrics(
    client: Client,
    campaignId: string
): Promise<Metrics | null> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.METRICS, [
        Query.equal('scope', MetricsScope.CAMPAIGN),
        Query.equal('scopeId', campaignId),
        Query.limit(1),
    ]);

    return result.documents.length > 0 ? documentToMetrics(result.documents[0]) : null;
}

/**
 * Increment metrics counters
 * Note: This performs a read-modify-write since Appwrite doesn't support atomic increments
 */
export async function incrementMetrics(
    client: Client,
    metricsId: string,
    increments: MetricsIncrementInput
): Promise<Metrics> {
    const databases = new Databases(client);

    // Get current values
    const doc = await databases.getDocument(DATABASE_ID, CollectionId.METRICS, metricsId);
    const current = documentToMetrics(doc);

    // Calculate new values
    const updates: Record<string, number | string> = {
        lastUpdatedAt: new Date().toISOString(),
    };

    if (increments.totalLeadsImported) {
        updates.totalLeadsImported = current.totalLeadsImported + increments.totalLeadsImported;
    }
    if (increments.totalEmailsSent) {
        updates.totalEmailsSent = current.totalEmailsSent + increments.totalEmailsSent;
    }
    if (increments.totalBounces) {
        updates.totalBounces = current.totalBounces + increments.totalBounces;
    }
    if (increments.totalHardBounces) {
        updates.totalHardBounces = current.totalHardBounces + increments.totalHardBounces;
    }
    if (increments.totalSoftBounces) {
        updates.totalSoftBounces = current.totalSoftBounces + increments.totalSoftBounces;
    }
    if (increments.totalComplaints) {
        updates.totalComplaints = current.totalComplaints + increments.totalComplaints;
    }
    if (increments.totalVerificationPassed) {
        updates.totalVerificationPassed =
            current.totalVerificationPassed + increments.totalVerificationPassed;
    }
    if (increments.totalVerificationFailed) {
        updates.totalVerificationFailed =
            current.totalVerificationFailed + increments.totalVerificationFailed;
    }
    if (increments.totalSkipped) {
        updates.totalSkipped = current.totalSkipped + increments.totalSkipped;
    }
    if (increments.totalErrors) {
        updates.totalErrors = current.totalErrors + increments.totalErrors;
    }
    if (increments.verifierCreditsUsed) {
        updates.verifierCreditsUsed = current.verifierCreditsUsed + increments.verifierCreditsUsed;
    }

    const updated = await databases.updateDocument(
        DATABASE_ID,
        CollectionId.METRICS,
        metricsId,
        updates
    );

    return documentToMetrics(updated);
}

/**
 * Increment global metrics
 */
export async function incrementGlobalMetrics(
    client: Client,
    increments: MetricsIncrementInput
): Promise<Metrics> {
    return incrementMetrics(client, GLOBAL_METRICS_ID, increments);
}

/**
 * Increment campaign metrics (creates if not exists)
 */
export async function incrementCampaignMetrics(
    client: Client,
    campaignId: string,
    increments: MetricsIncrementInput
): Promise<Metrics> {
    const databases = new Databases(client);

    // Check if campaign metrics exist
    let campaignMetrics = await getCampaignMetrics(client, campaignId);

    if (!campaignMetrics) {
        // Create campaign metrics document
        const doc = await databases.createDocument(
            DATABASE_ID,
            CollectionId.METRICS,
            `campaign_${campaignId}`,
            {
                scope: MetricsScope.CAMPAIGN,
                scopeId: campaignId,
                totalLeadsImported: 0,
                totalEmailsSent: 0,
                totalBounces: 0,
                totalHardBounces: 0,
                totalSoftBounces: 0,
                totalComplaints: 0,
                totalVerificationPassed: 0,
                totalVerificationFailed: 0,
                totalSkipped: 0,
                totalErrors: 0,
                verifierCreditsUsed: 0,
                lastUpdatedAt: new Date().toISOString(),
            }
        );
        campaignMetrics = documentToMetrics(doc);
    }

    return incrementMetrics(client, campaignMetrics.$id, increments);
}
