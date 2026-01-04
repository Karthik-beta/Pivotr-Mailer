/**
 * Migration 005: Create Metrics Collection
 * 
 * Creates the pre-aggregated metrics collection.
 * Updated atomically via increment operations, never full table scans.
 */
import { Client, Databases } from 'node-appwrite';
import { DATABASE_ID, CollectionId } from '../shared/constants/collection.constants';
import { MetricsScope } from '../shared/constants/status.constants';

export async function createMetricsCollection(client: Client): Promise<void> {
    const databases = new Databases(client);
    const collectionId = CollectionId.METRICS;

    try {
        await databases.getCollection(DATABASE_ID, collectionId);
        console.log(`Collection '${collectionId}' already exists. Skipping.`);
        return;
    } catch {
        // Collection doesn't exist, create it
    }

    // Create collection
    await databases.createCollection(
        DATABASE_ID,
        collectionId,
        'Metrics',
        undefined,
        true,
        true
    );

    console.log(`Collection '${collectionId}' created. Adding attributes...`);

    // Scope
    await databases.createEnumAttribute(
        DATABASE_ID,
        collectionId,
        'scope',
        Object.values(MetricsScope),
        true
    );

    // Scope ID (campaign ID for CAMPAIGN scope, null for GLOBAL)
    await databases.createStringAttribute(DATABASE_ID, collectionId, 'scopeId', 36, false);

    // Counters - all default to 0
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalLeadsImported', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalEmailsSent', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalBounces', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalHardBounces', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalSoftBounces', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalComplaints', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalVerificationPassed', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalVerificationFailed', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalSkipped', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'totalErrors', true, 0);
    await databases.createIntegerAttribute(DATABASE_ID, collectionId, 'verifierCreditsUsed', true, 0);

    // Last update timestamp
    await databases.createDatetimeAttribute(DATABASE_ID, collectionId, 'lastUpdatedAt', true);

    console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 * 
 * Collection ID: metrics
 * Collection Name: Metrics
 * 
 * Attributes:
 * - scope: Enum (GLOBAL, CAMPAIGN) [Required]
 * - scopeId: String (36)
 * - totalLeadsImported: Integer [Required, Default: 0]
 * - totalEmailsSent: Integer [Required, Default: 0]
 * - totalBounces: Integer [Required, Default: 0]
 * - totalHardBounces: Integer [Required, Default: 0]
 * - totalSoftBounces: Integer [Required, Default: 0]
 * - totalComplaints: Integer [Required, Default: 0]
 * - totalVerificationPassed: Integer [Required, Default: 0]
 * - totalVerificationFailed: Integer [Required, Default: 0]
 * - totalSkipped: Integer [Required, Default: 0]
 * - totalErrors: Integer [Required, Default: 0]
 * - verifierCreditsUsed: Integer [Required, Default: 0]
 * - lastUpdatedAt: Datetime [Required]
 */
