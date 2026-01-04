/**
 * Migration 004: Create Logs Collection
 *
 * Creates the immutable audit trail collection.
 * Logs should be append-only and never modified or deleted.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";
import { EventType } from "../shared/constants/event.constants";
import { LogSeverity } from "../shared/constants/status.constants";

export async function createLogsCollection(client: Client): Promise<void> {
	const databases = new Databases(client);
	const collectionId = CollectionId.LOGS;

	try {
		await databases.getCollection(DATABASE_ID, collectionId);
		console.log(`Collection '${collectionId}' already exists. Skipping.`);
		return;
	} catch {
		// Collection doesn't exist, create it
	}

	// Create collection
	await databases.createCollection(DATABASE_ID, collectionId, "Logs", undefined, true, true);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// Event classification
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"eventType",
		Object.values(EventType),
		true
	);

	// References
	await databases.createStringAttribute(DATABASE_ID, collectionId, "leadId", 36, false);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "campaignId", 36, false);

	// Severity
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"severity",
		Object.values(LogSeverity),
		true,
		LogSeverity.INFO
	);

	// Message
	await databases.createStringAttribute(DATABASE_ID, collectionId, "message", 1000, true);

	// Audit trail - FULL MESSAGE RECONSTRUCTION (Critical for compliance)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "resolvedSubject", 998, false);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "resolvedBody", 100000, false); // Full email body
	await databases.createStringAttribute(
		DATABASE_ID,
		collectionId,
		"templateVariables",
		5000,
		false
	); // JSON string

	// External API responses (JSON strings)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "verifierResponse", 5000, false);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "sesResponse", 5000, false);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "sqsMessage", 10000, false);

	// Performance metrics
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "processingTimeMs", false);

	// Error details (JSON string)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "errorDetails", 5000, false);

	// Extensible metadata (JSON string)
	await databases.createStringAttribute(DATABASE_ID, collectionId, "metadata", 5000, false);

	console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Collection ID: logs
 * Collection Name: Logs
 *
 * IMPORTANT: Configure permissions to be append-only (create only, no update/delete)
 *
 * Attributes:
 * - eventType: Enum [Required]
 * - leadId: String (36)
 * - campaignId: String (36)
 * - severity: Enum [Required, Default: INFO]
 * - message: String (1000) [Required]
 * - resolvedSubject: String (998)
 * - resolvedBody: String (100000) -- FULL EMAIL BODY FOR AUDIT
 * - templateVariables: String (5000) -- JSON
 * - verifierResponse: String (5000) -- JSON
 * - sesResponse: String (5000) -- JSON
 * - sqsMessage: String (10000) -- JSON
 * - processingTimeMs: Integer
 * - errorDetails: String (5000) -- JSON
 * - metadata: String (5000) -- JSON
 */
