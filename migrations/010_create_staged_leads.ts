/**
 * Migration 010: Create Staged Leads Collection
 *
 * Creates the staged_leads collection for Excel import staging workflow.
 * Staged leads are reviewed and approved before moving to the main leads collection.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

export async function createStagedLeadsCollection(client: Client): Promise<void> {
	const databases = new Databases(client);
	const collectionId = CollectionId.STAGED_LEADS;

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
		"Staged Leads",
		undefined, // permissions (inherit from database)
		true, // documentSecurity
		true // enabled
	);

	console.log(`Collection '${collectionId}' created. Adding attributes...`);

	// Batch grouping
	await databases.createStringAttribute(DATABASE_ID, collectionId, "batchId", 36, true);

	// Row tracking
	await databases.createIntegerAttribute(DATABASE_ID, collectionId, "rowNumber", true);

	// Core lead fields
	await databases.createStringAttribute(DATABASE_ID, collectionId, "fullName", 255, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "email", 255, true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "companyName", 255, true);

	// Optional fields
	await databases.createStringAttribute(DATABASE_ID, collectionId, "phoneNumber", 20, false);
	await databases.createEnumAttribute(
		DATABASE_ID,
		collectionId,
		"leadType",
		["HARDWARE", "SOFTWARE", "BOTH"],
		false
	);

	// Validation status
	await databases.createStringAttribute(DATABASE_ID, collectionId, "validationErrors", 5000, false);
	await databases.createBooleanAttribute(DATABASE_ID, collectionId, "isValid", true);

	// Import metadata
	await databases.createDatetimeAttribute(DATABASE_ID, collectionId, "importedAt", true);
	await databases.createStringAttribute(DATABASE_ID, collectionId, "importedBy", 36, false);

	// Extensible metadata
	await databases.createStringAttribute(DATABASE_ID, collectionId, "metadata", 10000, false);

	console.log(`Collection '${collectionId}' created with all attributes.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Collection ID: staged_leads
 * Collection Name: Staged Leads
 * Document Security: Enabled
 *
 * Attributes:
 * - batchId: String (36) [Required] - Groups rows from same import
 * - rowNumber: Integer [Required] - Original Excel row number
 * - fullName: String (255) [Required] - Raw imported name
 * - email: String (255) [Required] - Raw imported email
 * - companyName: String (255) [Required] - Raw imported company
 * - validationErrors: String (5000) - JSON array of FieldValidationIssue
 * - isValid: Boolean [Required] - True if no error-severity issues
 * - importedAt: Datetime [Required] - Upload timestamp
 * - importedBy: String (36) - User ID who uploaded
 * - metadata: String (10000) - Additional columns as JSON
 *
 * Indexes (create in 007_create_indexes.ts):
 * - batchId (for batch queries)
 * - isValid (for filtering)
 */
