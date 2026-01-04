/**
 * Migration: Create Locks Collection
 * 
 * Creates the locks collection for database-based campaign locking.
 * This is used instead of Redis for simpler networking in Docker.
 */
import { Client, Databases } from 'node-appwrite';
import { DATABASE_ID } from '../shared/constants/collection.constants';

const LOCKS_COLLECTION_ID = 'locks';

export async function createLocksCollection(client: Client): Promise<void> {
    const databases = new Databases(client);

    try {
        await databases.getCollection(DATABASE_ID, LOCKS_COLLECTION_ID);
        console.log(`Collection '${LOCKS_COLLECTION_ID}' already exists. Skipping.`);
        return;
    } catch {
        // Collection doesn't exist, create it
    }

    // Create collection
    await databases.createCollection(
        DATABASE_ID,
        LOCKS_COLLECTION_ID,
        'Locks',
        undefined,
        true,
        true
    );

    console.log(`Collection '${LOCKS_COLLECTION_ID}' created. Adding attributes...`);

    // Lock attributes
    await databases.createStringAttribute(DATABASE_ID, LOCKS_COLLECTION_ID, 'campaignId', 36, true);
    await databases.createStringAttribute(DATABASE_ID, LOCKS_COLLECTION_ID, 'instanceId', 50, true);
    await databases.createDatetimeAttribute(DATABASE_ID, LOCKS_COLLECTION_ID, 'acquiredAt', true);
    await databases.createDatetimeAttribute(DATABASE_ID, LOCKS_COLLECTION_ID, 'expiresAt', true);

    // Create index on campaignId for fast lookups
    await databases.createIndex(
        DATABASE_ID,
        LOCKS_COLLECTION_ID,
        'campaign_idx',
        'key',
        ['campaignId']
    );

    // Create index on expiresAt for stale lock cleanup
    await databases.createIndex(
        DATABASE_ID,
        LOCKS_COLLECTION_ID,
        'expires_idx',
        'key',
        ['expiresAt']
    );

    console.log(`Collection '${LOCKS_COLLECTION_ID}' created with all attributes.`);
}
