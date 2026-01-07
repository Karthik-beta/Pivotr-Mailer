/**
 * Migration 012: Add Lead Type to Leads
 *
 * Adds the leadType enum attribute to the leads collection.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";
import { LeadType } from "../shared/constants/status.constants";

export async function addLeadTypeToLeads(client: Client): Promise<void> {
    const databases = new Databases(client);
    const collectionId = CollectionId.LEADS;

    console.log(`Adding leadType attribute to '${collectionId}'...`);

    try {
        // Create leadType enum attribute (optional, default null)
        // Note: Appwrite requires providing elements for Enum.
        await databases.createEnumAttribute(
            DATABASE_ID,
            collectionId,
            "leadType",
            Object.values(LeadType),
            false
        );
        console.log("Attribute 'leadType' created.");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("already exists")) {
            console.log("Attribute 'leadType' already exists. Skipping.");
        } else {
            throw error;
        }
    }
}
