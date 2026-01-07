/**
 * Migration 011: Add Phone Number to Leads
 *
 * Adds the phoneNumber attribute to the leads collection.
 */
import { type Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

export async function addPhoneNumberToLeads(client: Client): Promise<void> {
    const databases = new Databases(client);
    const collectionId = CollectionId.LEADS;

    console.log(`Adding phoneNumber attribute to '${collectionId}'...`);

    try {
        // Create phoneNumber attribute (optional, 20 chars)
        await databases.createStringAttribute(DATABASE_ID, collectionId, "phoneNumber", 20, false);
        console.log("Attribute 'phoneNumber' created.");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("already exists")) {
            console.log("Attribute 'phoneNumber' already exists. Skipping.");
        } else {
            throw error;
        }
    }
}
