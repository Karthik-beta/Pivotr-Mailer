/**
 * Migration 003: Create Campaigns Collection
 *
 * Creates the campaigns collection with Gaussian timing configuration.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";
import { CampaignStatus } from "../shared/constants/status.constants";

export async function createCampaignsCollection(client: Client): Promise<void> {
	const databases = new Databases(client);
	const collectionId = CollectionId.CAMPAIGNS;

	try {
		await databases.getCollection(DATABASE_ID, collectionId);
		console.log(`Collection '${collectionId}' already exists. Skipping.`);
		return;
	} catch {
		// Collection doesn't exist, create it
	}

	// Create collection
	await databases.createCollection(DATABASE_ID, collectionId, "Campaigns", undefined, true, true);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// Basic info
	await databases.createStringAttribute(DATABASE_ID, collectionId, "name", 255, true);

	// Status enum (optional with default - Appwrite requires this for defaulted attrs)
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"status",
		Object.values(CampaignStatus),
		false,
		CampaignStatus.DRAFT
	);

	// Templates (Spintax-enabled)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "subjectTemplate", 998, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "bodyTemplate", 100000, true); // Large text body

	// Sender configuration
	await databases.createEmailAttribute(DATABASE_ID, collectionId, "senderEmail", true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "senderName", 255, true);

	// Counters (optional with defaults - Appwrite requires this for defaulted attrs)
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "totalLeads", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "processedCount", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "skippedCount", false, 0);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "errorCount", false, 0);

	// Pause/Resume state
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "pausedAt", false);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "resumePosition", false);

	// Gaussian timing configuration (optional with defaults)
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "minDelayMs", false, 60000);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "maxDelayMs", false, 180000);
	await databases.createFloatAttribute(DATABASE_ID, collectionId, "gaussianMean", false);
	await databases.createFloatAttribute(DATABASE_ID, collectionId, "gaussianStdDev", false);

	// Catch-all handling (optional with default)
	await databases.createBooleanAttribute(DATABASE_ID, collectionId, "allowCatchAll", false, false);

	// Timestamps
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "lastActivityAt", false);
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "completedAt", false);

	console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Collection ID: campaigns
 * Collection Name: Campaigns
 *
 * Attributes:
 * - name: String (255) [Required]
 * - status: Enum [Required, Default: DRAFT]
 * - subjectTemplate: String (998) [Required]
 * - bodyTemplate: String (100000) [Required]
 * - senderEmail: Email [Required]
 * - senderName: String (255) [Required]
 * - totalLeads: Integer [Required, Default: 0]
 * - processedCount: Integer [Required, Default: 0]
 * - skippedCount: Integer [Required, Default: 0]
 * - errorCount: Integer [Required, Default: 0]
 * - pausedAt: Datetime
 * - resumePosition: Integer
 * - minDelayMs: Integer [Required, Default: 60000]
 * - maxDelayMs: Integer [Required, Default: 180000]
 * - gaussianMean: Float
 * - gaussianStdDev: Float
 * - allowCatchAll: Boolean [Required, Default: false]
 * - lastActivityAt: Datetime
 * - completedAt: Datetime
 */
