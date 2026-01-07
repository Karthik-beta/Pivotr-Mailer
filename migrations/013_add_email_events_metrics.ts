/**
 * Migration 013: Add Email Events Metrics
 *
 * Adds new metric fields for tracking all SES event types:
 * - totalDelivered: Successfully delivered emails
 * - totalOpens: Email opens (tracking pixel)
 * - totalClicks: Link clicks in emails
 * - totalRejected: Emails rejected by SES (virus/spam)
 * - totalDelayed: Emails with temporary delivery delays
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

export async function addEmailEventsMetrics(client: Client): Promise<void> {
    const databases = new Databases(client);
    const collectionId = CollectionId.METRICS;

    console.log(`Adding new email event metrics to '${collectionId}'...`);

    // Check if collection exists
    try {
        await databases.getCollection(DATABASE_ID, collectionId);
    } catch {
        console.error(`Collection '${collectionId}' does not exist. Run previous migrations first.`);
        return;
    }

    // Add new metric attributes
    const newAttributes = [
        { name: "totalDelivered", default: 0 },
        { name: "totalOpens", default: 0 },
        { name: "totalClicks", default: 0 },
        { name: "totalRejected", default: 0 },
        { name: "totalDelayed", default: 0 },
    ];

    for (const attr of newAttributes) {
        try {
            await databases.createIntegerAttribute(
                DATABASE_ID,
                collectionId,
                attr.name,
                false,
                attr.default
            );
            console.log(`  ✓ Added attribute: ${attr.name}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("already exists")) {
                console.log(`  ⏭ Attribute '${attr.name}' already exists. Skipping.`);
            } else {
                console.error(`  ✗ Failed to add '${attr.name}': ${message}`);
            }
        }
    }

    console.log(`Migration complete for '${collectionId}'.`);
}

/**
 * Appwrite Console Instructions (Manual)
 *
 * Add the following attributes to the 'metrics' collection:
 * - totalDelivered: Integer [Default: 0]
 * - totalOpens: Integer [Default: 0]
 * - totalClicks: Integer [Default: 0]
 * - totalRejected: Integer [Default: 0]
 * - totalDelayed: Integer [Default: 0]
 */
