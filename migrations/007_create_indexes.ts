/**
 * Migration 007: Create Indexes
 *
 * Creates all required indexes for query performance.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

export async function createIndexes(client: Client): Promise<void> {
	const databases = new Databases(client);

	console.log("Creating indexes...");

	// ===== LEADS COLLECTION INDEXES =====

	// Status index for queue filtering
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LEADS, "status_idx", "key", ["status"]);
		console.log("Created index: leads.status_idx");
	} catch (e) {
		console.log("Index leads.status_idx already exists or failed:", (e as Error).message);
	}

	// Unique email index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LEADS, "email_unique_idx", "unique", [
			"email",
		]);
		console.log("Created index: leads.email_unique_idx");
	} catch (e) {
		console.log("Index leads.email_unique_idx already exists or failed:", (e as Error).message);
	}

	// Unsubscribed filter index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LEADS, "unsubscribed_idx", "key", [
			"isUnsubscribed",
		]);
		console.log("Created index: leads.unsubscribed_idx");
	} catch (e) {
		console.log("Index leads.unsubscribed_idx already exists or failed:", (e as Error).message);
	}

	// Campaign queue compound index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LEADS, "campaign_queue_idx", "key", [
			"campaignId",
			"status",
			"queuePosition",
		]);
		console.log("Created index: leads.campaign_queue_idx");
	} catch (e) {
		console.log("Index leads.campaign_queue_idx already exists or failed:", (e as Error).message);
	}

	// SES Message ID lookup (for bounce/complaint processing)
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LEADS, "ses_message_idx", "key", [
			"sesMessageId",
		]);
		console.log("Created index: leads.ses_message_idx");
	} catch (e) {
		console.log("Index leads.ses_message_idx already exists or failed:", (e as Error).message);
	}

	// ===== CAMPAIGNS COLLECTION INDEXES =====

	// Status index for campaign lookup
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.CAMPAIGNS, "status_idx", "key", [
			"status",
		]);
		console.log("Created index: campaigns.status_idx");
	} catch (e) {
		console.log("Index campaigns.status_idx already exists or failed:", (e as Error).message);
	}

	// ===== LOGS COLLECTION INDEXES =====

	// Event type index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LOGS, "event_type_idx", "key", [
			"eventType",
		]);
		console.log("Created index: logs.event_type_idx");
	} catch (e) {
		console.log("Index logs.event_type_idx already exists or failed:", (e as Error).message);
	}

	// Lead reference index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LOGS, "lead_idx", "key", ["leadId"]);
		console.log("Created index: logs.lead_idx");
	} catch (e) {
		console.log("Index logs.lead_idx already exists or failed:", (e as Error).message);
	}

	// Campaign reference index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LOGS, "campaign_idx", "key", [
			"campaignId",
		]);
		console.log("Created index: logs.campaign_idx");
	} catch (e) {
		console.log("Index logs.campaign_idx already exists or failed:", (e as Error).message);
	}

	// Severity index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.LOGS, "severity_idx", "key", [
			"severity",
		]);
		console.log("Created index: logs.severity_idx");
	} catch (e) {
		console.log("Index logs.severity_idx already exists or failed:", (e as Error).message);
	}

	// ===== METRICS COLLECTION INDEXES =====

	// Scope index
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.METRICS, "scope_idx", "key", ["scope"]);
		console.log("Created index: metrics.scope_idx");
	} catch (e) {
		console.log("Index metrics.scope_idx already exists or failed:", (e as Error).message);
	}

	// Scope ID index for campaign-specific lookups
	try {
		await databases.createIndex(DATABASE_ID, CollectionId.METRICS, "scope_id_idx", "key", [
			"scopeId",
		]);
		console.log("Created index: metrics.scope_id_idx");
	} catch (e) {
		console.log("Index metrics.scope_id_idx already exists or failed:", (e as Error).message);
	}

	console.log("All indexes created.");
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Navigate to each collection and create the following indexes:
 *
 * LEADS:
 * - status_idx: Key on [status]
 * - email_unique_idx: Unique on [email]
 * - unsubscribed_idx: Key on [isUnsubscribed]
 * - campaign_queue_idx: Key on [campaignId, status, queuePosition]
 * - ses_message_idx: Key on [sesMessageId]
 *
 * CAMPAIGNS:
 * - status_idx: Key on [status]
 *
 * LOGS:
 * - event_type_idx: Key on [eventType]
 * - lead_idx: Key on [leadId]
 * - campaign_idx: Key on [campaignId]
 * - severity_idx: Key on [severity]
 *
 * METRICS:
 * - scope_idx: Key on [scope]
 * - scope_id_idx: Key on [scopeId]
 */
