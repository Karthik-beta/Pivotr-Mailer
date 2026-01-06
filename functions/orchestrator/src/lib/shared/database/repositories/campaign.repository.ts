/**
 * Campaign Repository
 *
 * Data access layer for the campaigns collection.
 */

import type { Client, Models } from 'node-appwrite';
import { Databases, ID, Query } from 'node-appwrite';
import { CollectionId, DATABASE_ID } from '../../constants/collection.constants';
import { CampaignStatus } from '../../constants/status.constants';
import type {
    Campaign,
    CampaignCreateInput,
    CampaignUpdateInput,
} from '../../types/campaign.types';

/**
 * Convert Appwrite document to Campaign type
 */
function documentToCampaign(doc: Models.Document): Campaign {
    return doc as unknown as Campaign;
}

/**
 * Create a new campaign
 */
export async function createCampaign(client: Client, data: CampaignCreateInput): Promise<Campaign> {
    const databases = new Databases(client);

    const doc = await databases.createDocument(DATABASE_ID, CollectionId.CAMPAIGNS, ID.unique(), {
        ...data,
        status: CampaignStatus.DRAFT,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        allowCatchAll: data.allowCatchAll ?? false,
    });

    return documentToCampaign(doc);
}

/**
 * Get a campaign by ID
 */
export async function getCampaignById(
    client: Client,
    campaignId: string
): Promise<Campaign | null> {
    const databases = new Databases(client);

    try {
        const doc = await databases.getDocument(DATABASE_ID, CollectionId.CAMPAIGNS, campaignId);
        return documentToCampaign(doc);
    } catch {
        return null;
    }
}

/**
 * Update a campaign
 */
export async function updateCampaign(
    client: Client,
    campaignId: string,
    data: CampaignUpdateInput
): Promise<Campaign> {
    const databases = new Databases(client);

    const doc = await databases.updateDocument(DATABASE_ID, CollectionId.CAMPAIGNS, campaignId, {
        ...data,
        lastActivityAt: new Date().toISOString(),
    });

    return documentToCampaign(doc);
}

/**
 * Get all running campaigns (for recovery on startup)
 */
export async function getRunningCampaigns(client: Client): Promise<Campaign[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
        Query.equal('status', CampaignStatus.RUNNING),
    ]);

    return result.documents.map(documentToCampaign);
}

/**
 * Get campaigns by status
 */
export async function getCampaignsByStatus(client: Client, status: string): Promise<Campaign[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
        Query.equal('status', status),
    ]);

    return result.documents.map(documentToCampaign);
}

/**
 * Increment campaign counter atomically
 * Note: Appwrite doesn't support atomic increments, so we read-modify-write
 */
export async function incrementCampaignCounter(
    client: Client,
    campaignId: string,
    field: 'processedCount' | 'skippedCount' | 'errorCount',
    amount: number = 1
): Promise<void> {
    const databases = new Databases(client);

    const campaign = await getCampaignById(client, campaignId);
    if (!campaign) return;

    const currentValue = campaign[field] || 0;

    await databases.updateDocument(DATABASE_ID, CollectionId.CAMPAIGNS, campaignId, {
        [field]: currentValue + amount,
        lastActivityAt: new Date().toISOString(),
    });
}

/**
 * Start a campaign
 */
export async function startCampaign(client: Client, campaignId: string): Promise<Campaign> {
    return updateCampaign(client, campaignId, {
        status: CampaignStatus.RUNNING,
        pausedAt: null,
    });
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(
    client: Client,
    campaignId: string,
    resumePosition: number
): Promise<Campaign> {
    return updateCampaign(client, campaignId, {
        status: CampaignStatus.PAUSED,
        pausedAt: new Date().toISOString(),
        resumePosition,
    });
}

/**
 * Complete a campaign
 */
export async function completeCampaign(client: Client, campaignId: string): Promise<Campaign> {
    return updateCampaign(client, campaignId, {
        status: CampaignStatus.COMPLETED,
        completedAt: new Date().toISOString(),
    });
}
