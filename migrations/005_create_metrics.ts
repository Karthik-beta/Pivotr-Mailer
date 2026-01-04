/**
 * Migration 005: Create Metrics Collection
 *
 * Creates the pre-aggregated metrics collection.
 * Updated atomically via increment operations, never full table scans.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";
import { MetricsScope } from "../shared/constants/status.constants";

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
	await databases.createCollection(DATABASE_ID, collectionId, "Metrics", undefined, true, true);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// Scope
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"scope",
		Object.values(MetricsScope),
		true
	);

	// Scope ID (campaign ID for CAMPAIGN scope, null for GLOBAL)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "scopeId", 36, false);

	// Counters - all default to 0 (optional with defaults - Appwrite requirement)
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalLeadsImported", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalEmailsSent", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalBounces", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalHardBounces", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalSoftBounces", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalComplaints", false, 0);
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"totalVerificationPassed",
		false,
		0
	);
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"totalVerificationFailed",
		false,
		0
	);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalSkipped", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalErrors", false, 0);
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"verifierCreditsUsed",
		false,
		0
	);

	// Last update timestamp
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "lastUpdatedAt", true);

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
