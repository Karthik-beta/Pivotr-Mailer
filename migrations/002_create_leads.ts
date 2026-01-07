/**
 * Migration 002: Create Leads Collection
 *
 * Creates the leads collection with all attributes defined in the schema.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";
import { LeadStatus } from "../shared/constants/status.constants";

export async function createLeadsCollection(client: Client): Promise<void> {
	const databases = new Databases(client);
	const collectionId = CollectionId.LEADS;

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
		"Leads",
		undefined, // permissions (inherit from database)
		true, // documentSecurity
		true // enabled
	);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// String attributes
	await databases.createStringAttribute(DATABASE_ID, collectionId, "fullName", 255, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "parsedFirstName", 100, false);
	await databases.createEmailAttribute(DATABASE_ID, collectionId, "email", true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "companyName", 255, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "phoneNumber", 20, false);

	// Lead Type
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"leadType",
		["HARDWARE", "SOFTWARE", "BOTH"],
		false
	);

	// Status enum (optional with default value - Appwrite doesn't allow defaults on required attrs)
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"status",
		Object.values(LeadStatus),
		false, // Must be optional when using default value
		LeadStatus.PENDING_IMPORT
	);

	// Verification fields
	await databases.createStringAttribute(DATABASE_ID, collectionId, "verificationResult", 50, false);
	await databases.createDatetimeAttribute(
		DATABASE_ID,
		collectionId,
		"verificationTimestamp",
		false
	);

	// SES fields
	await databases.createStringAttribute(DATABASE_ID, collectionId, "sesMessageId", 100, false);

	// Bounce/Complaint fields
	await databases.createStringAttribute(DATABASE_ID, collectionId, "bounceType", 50, false);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "bounceSubType", 50, false);
	await databases.createStringAttribute(
		DATABASE_ID,
		collectionId,
		"complaintFeedbackType",
		50,
		false
	);

	// Campaign relationship
	await databases.createStringAttribute(DATABASE_ID, collectionId, "campaignId", 36, false);
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "queuePosition", false);

	// Processing timestamps
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "processingStartedAt", false);
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "processedAt", false);

	// Error handling
	await databases.createStringAttribute(DATABASE_ID, collectionId, "errorMessage", 1000, false);

	// Unsubscribe (GDPR/CAN-SPAM compliance) - optional with default
	await databases.createBooleanAttribute(DATABASE_ID, collectionId, "isUnsubscribed", false, false);
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "unsubscribedAt", false);

	// Extensible metadata
	// Note: Appwrite doesn't have a native JSON type, using string for flexibility
	await databases.createStringAttribute(DATABASE_ID, collectionId, "metadata", 10000, false);

	console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Collection ID: leads
 * Collection Name: Leads
 * Document Security: Enabled
 *
 * Attributes:
 * - fullName: String (255) [Required]
 * - parsedFirstName: String (100)
 * - email: Email [Required, Unique]
 * - companyName: String (255) [Required]
 * - status: Enum [Required, Default: PENDING_IMPORT]
 * - verificationResult: String (50)
 * - verificationTimestamp: Datetime
 * - sesMessageId: String (100)
 * - bounceType: String (50)
 * - bounceSubType: String (50)
 * - complaintFeedbackType: String (50)
 * - campaignId: String (36)
 * - queuePosition: Integer
 * - processingStartedAt: Datetime
 * - processedAt: Datetime
 * - errorMessage: String (1000)
 * - isUnsubscribed: Boolean [Required, Default: false]
 * - unsubscribedAt: Datetime
 * - metadata: String (10000)
 */
