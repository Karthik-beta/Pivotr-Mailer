/**
 * Migration 006: Create Settings Collection
 *
 * Creates the singleton settings collection for system-wide configuration.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

export async function createSettingsCollection(client: Client): Promise<void> {
	const databases = new Databases(client);
	const collectionId = CollectionId.SETTINGS;

	try {
		await databases.getCollection(DATABASE_ID, collectionId);
		console.log(`Collection '${collectionId}' already exists. Skipping.`);
		return;
	} catch {
		// Collection doesn't exist, create it
	}

	// Create collection
	await databases.createCollection(DATABASE_ID, collectionId, "Settings", undefined, true, true);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// AWS SES Configuration
	await databases.createStringAttribute(DATABASE_ID, collectionId, "awsSesRegion", 50, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "awsSesAccessKeyId", 100, true);
	await databases.createStringAttribute(
		DATABASE_ID,
		collectionId,
		"awsSesSecretAccessKey",
		200,
		true
	);

	// AWS SQS Configuration
	await databases.createStringAttribute(DATABASE_ID, collectionId, "awsSqsQueueUrl", 500, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "awsSqsRegion", 50, true);

	// MyEmailVerifier Configuration
	await databases.createStringAttribute(
		DATABASE_ID,
		collectionId,
		"myEmailVerifierApiKey",
		200,
		true
	);

	// Timing defaults (optional with defaults - Appwrite requirement)
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"defaultMinDelayMs",
		false,
		60000
	);
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"defaultMaxDelayMs",
		false,
		180000
	);

	// Polling intervals (optional with defaults)
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"sqsPollingIntervalMs",
		false,
		60000
	);

	// Timeouts (optional with defaults)
	await databases.createIntegerAttribute(
		DATABASE_ID,
		collectionId,
		"verifierTimeoutMs",
		false,
		10000
	);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "sesTimeoutMs", false, 30000);

	// Retry configuration (optional with defaults)
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "maxRetries", false, 3);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "retryBackoffMs", false, 1000);

	// Unsubscribe token secret (HMAC)
	await databases.createStringAttribute(
		DATABASE_ID,
		collectionId,
		"unsubscribeTokenSecret",
		256,
		true
	);

	console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Collection ID: settings
 * Collection Name: Settings
 *
 * NOTE: This is a singleton collection. Only one document should exist
 * with ID "global_settings".
 *
 * SECURITY: Sensitive fields should be stored in Appwrite Function
 * environment variables in production, not in this collection.
 *
 * Attributes:
 * - awsSesRegion: String (50) [Required]
 * - awsSesAccessKeyId: String (100) [Required]
 * - awsSesSecretAccessKey: String (200) [Required]
 * - awsSqsQueueUrl: String (500) [Required]
 * - awsSqsRegion: String (50) [Required]
 * - myEmailVerifierApiKey: String (200) [Required]
 * - defaultMinDelayMs: Integer [Required, Default: 60000]
 * - defaultMaxDelayMs: Integer [Required, Default: 180000]
 * - sqsPollingIntervalMs: Integer [Required, Default: 60000]
 * - verifierTimeoutMs: Integer [Required, Default: 10000]
 * - sesTimeoutMs: Integer [Required, Default: 30000]
 * - maxRetries: Integer [Required, Default: 3]
 * - retryBackoffMs: Integer [Required, Default: 1000]
 * - unsubscribeTokenSecret: String (256) [Required]
 */
