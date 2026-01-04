/**
 * Campaign Lock Manager
 * 
 * Prevents concurrent execution of the same campaign across
 * multiple Appwrite Function instances using database-based locking.
 * 
 * This implementation uses Appwrite Database instead of Redis
 * for easier networking in Docker environments.
 */

import { Databases, Query, ID } from 'node-appwrite';
import type { Client } from 'node-appwrite';
import {
    LOCK_TTL_SECONDS,
    STALE_LOCK_THRESHOLD_MS,
    DATABASE_ID
} from '../../../../shared/constants/collection.constants';
import { LockError } from '../errors/base-error';

/**
 * Lock collection ID (add to collection.constants.ts if not exists)
 */
const LOCKS_COLLECTION_ID = 'locks';

/**
 * Lock document structure
 */
interface LockDocument {
    $id: string;
    $createdAt: string;
    campaignId: string;
    instanceId: string;
    acquiredAt: string;
    expiresAt: string;
}

/**
 * Lock acquisition result
 */
export interface LockResult {
    acquired: boolean;
    lockId?: string;
    message: string;
}

/**
 * Generate a unique instance ID for this function execution.
 */
function generateInstanceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
}

/**
 * Attempt to acquire a lock for a campaign.
 */
export async function acquireCampaignLock(
    client: Client,
    campaignId: string
): Promise<LockResult> {
    const databases = new Databases(client);
    const instanceId = generateInstanceId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);

    try {
        // Check for existing lock
        const existingLocks = await databases.listDocuments(
            DATABASE_ID,
            LOCKS_COLLECTION_ID,
            [Query.equal('campaignId', campaignId)]
        );

        if (existingLocks.documents.length > 0) {
            const existingLock = existingLocks.documents[0] as unknown as LockDocument;
            const lockExpiresAt = new Date(existingLock.expiresAt);

            // Check if lock is stale
            if (now > lockExpiresAt) {
                // Lock is expired, delete it and try to acquire
                await databases.deleteDocument(DATABASE_ID, LOCKS_COLLECTION_ID, existingLock.$id);
                console.info(`Deleted stale lock for campaign ${campaignId}`);
            } else {
                // Lock is still valid
                return {
                    acquired: false,
                    message: `Campaign ${campaignId} is locked by instance ${existingLock.instanceId}`,
                };
            }
        }

        // Create new lock
        const lockDoc = await databases.createDocument(
            DATABASE_ID,
            LOCKS_COLLECTION_ID,
            ID.unique(),
            {
                campaignId,
                instanceId,
                acquiredAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
            }
        );

        return {
            acquired: true,
            lockId: lockDoc.$id,
            message: `Lock acquired for campaign ${campaignId}`,
        };

    } catch (error) {
        // If document creation fails (race condition), another instance got the lock
        if ((error as Error).message?.includes('Document with the requested ID already exists')) {
            return {
                acquired: false,
                message: `Campaign ${campaignId} lock acquired by another instance`,
            };
        }

        throw new LockError(`Failed to acquire lock: ${(error as Error).message}`, { campaignId });
    }
}

/**
 * Refresh a lock's TTL to prevent expiration during long operations.
 */
export async function refreshCampaignLock(
    client: Client,
    lockId: string
): Promise<boolean> {
    const databases = new Databases(client);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);

    try {
        await databases.updateDocument(
            DATABASE_ID,
            LOCKS_COLLECTION_ID,
            lockId,
            { expiresAt: expiresAt.toISOString() }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Release a campaign lock.
 */
export async function releaseCampaignLock(
    client: Client,
    lockId: string
): Promise<boolean> {
    const databases = new Databases(client);

    try {
        await databases.deleteDocument(DATABASE_ID, LOCKS_COLLECTION_ID, lockId);
        return true;
    } catch {
        return false;
    }
}

/**
 * Clean up all stale locks (for recovery on system startup).
 */
export async function cleanupStaleLocks(client: Client): Promise<number> {
    const databases = new Databases(client);
    const threshold = new Date(Date.now() - STALE_LOCK_THRESHOLD_MS);

    try {
        const staleLocks = await databases.listDocuments(
            DATABASE_ID,
            LOCKS_COLLECTION_ID,
            [Query.lessThan('expiresAt', threshold.toISOString())]
        );

        let cleaned = 0;
        for (const lock of staleLocks.documents) {
            try {
                await databases.deleteDocument(DATABASE_ID, LOCKS_COLLECTION_ID, lock.$id);
                cleaned++;
            } catch {
                // Ignore individual deletion failures
            }
        }

        return cleaned;
    } catch {
        return 0;
    }
}

/**
 * Execute a function while holding a campaign lock.
 */
export async function withCampaignLock<T>(
    client: Client,
    campaignId: string,
    fn: () => Promise<T>,
    options?: { refreshIntervalMs?: number }
): Promise<T> {
    const lockResult = await acquireCampaignLock(client, campaignId);

    if (!lockResult.acquired || !lockResult.lockId) {
        throw new LockError(lockResult.message, { campaignId });
    }

    const lockId = lockResult.lockId;
    const refreshInterval = options?.refreshIntervalMs ?? 30000;

    // Set up lock refresh interval
    const refreshTimer = setInterval(async () => {
        await refreshCampaignLock(client, lockId);
    }, refreshInterval);

    try {
        return await fn();
    } finally {
        clearInterval(refreshTimer);
        await releaseCampaignLock(client, lockId);
    }
}
