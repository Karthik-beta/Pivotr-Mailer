/**
 * Lead Repository
 *
 * Data access layer for the leads collection.
 * All database operations for leads should go through this module.
 */

import type { Client, Models } from 'node-appwrite';
import { Databases, ID, Query } from 'node-appwrite';
import { CollectionId, DATABASE_ID } from '../../../../shared/constants/collection.constants';
import { LeadStatus } from '../../../../shared/constants/status.constants';
import type { Lead, LeadCreateInput, LeadUpdateInput } from '../../../../shared/types/lead.types';

/**
 * Convert Appwrite document to Lead type
 */
function documentToLead(doc: Models.Document): Lead {
	return doc as unknown as Lead;
}

/**
 * Create a new lead
 */
export async function createLead(client: Client, data: LeadCreateInput): Promise<Lead> {
	const databases = new Databases(client);

	const doc = await databases.createDocument(DATABASE_ID, CollectionId.LEADS, ID.unique(), {
		...data,
		status: data.status ?? LeadStatus.PENDING_IMPORT,
		isUnsubscribed: false,
	});

	return documentToLead(doc);
}

/**
 * Get a lead by ID
 */
export async function getLeadById(client: Client, leadId: string): Promise<Lead | null> {
	const databases = new Databases(client);

	try {
		const doc = await databases.getDocument(DATABASE_ID, CollectionId.LEADS, leadId);
		return documentToLead(doc);
	} catch {
		return null;
	}
}

/**
 * Update a lead
 */
export async function updateLead(
	client: Client,
	leadId: string,
	data: LeadUpdateInput
): Promise<Lead> {
	const databases = new Databases(client);

	const doc = await databases.updateDocument(DATABASE_ID, CollectionId.LEADS, leadId, data);

	return documentToLead(doc);
}

/**
 * Find lead by email
 */
export async function findLeadByEmail(client: Client, email: string): Promise<Lead | null> {
	const databases = new Databases(client);

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('email', email),
		Query.limit(1),
	]);

	return result.documents.length > 0 ? documentToLead(result.documents[0]) : null;
}

/**
 * Find lead by SES Message ID (for bounce/complaint processing)
 */
export async function findLeadBySesMessageId(
	client: Client,
	sesMessageId: string
): Promise<Lead | null> {
	const databases = new Databases(client);

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('sesMessageId', sesMessageId),
		Query.limit(1),
	]);

	return result.documents.length > 0 ? documentToLead(result.documents[0]) : null;
}

/**
 * Get next lead in queue for a campaign
 */
export async function getNextQueuedLead(client: Client, campaignId: string): Promise<Lead | null> {
	const databases = new Databases(client);

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('campaignId', campaignId),
		Query.equal('status', LeadStatus.QUEUED),
		Query.equal('isUnsubscribed', false),
		Query.orderAsc('queuePosition'),
		Query.limit(1),
	]);

	return result.documents.length > 0 ? documentToLead(result.documents[0]) : null;
}

/**
 * Get leads stuck in SENDING status (for recovery)
 */
export async function getSendingLeads(
	client: Client,
	campaignId: string,
	olderThanMs: number
): Promise<Lead[]> {
	const databases = new Databases(client);
	const threshold = new Date(Date.now() - olderThanMs).toISOString();

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('campaignId', campaignId),
		Query.equal('status', LeadStatus.SENDING),
		Query.lessThan('processingStartedAt', threshold),
	]);

	return result.documents.map(documentToLead);
}

/**
 * Count leads by status for a campaign
 */
export async function countLeadsByStatus(
	client: Client,
	campaignId: string,
	status: string
): Promise<number> {
	const databases = new Databases(client);

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('campaignId', campaignId),
		Query.equal('status', status),
		Query.limit(0), // We only need the total count
	]);

	return result.total;
}

/**
 * Count remaining leads to process
 */
export async function countRemainingLeads(client: Client, campaignId: string): Promise<number> {
	const databases = new Databases(client);

	const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
		Query.equal('campaignId', campaignId),
		Query.equal('status', LeadStatus.QUEUED),
		Query.equal('isUnsubscribed', false),
		Query.limit(0),
	]);

	return result.total;
}

/**
 * Bulk update leads for a campaign
 */
export async function assignLeadsToCampaign(
	client: Client,
	leadIds: string[],
	campaignId: string
): Promise<void> {
	const databases = new Databases(client);

	for (let i = 0; i < leadIds.length; i++) {
		await databases.updateDocument(DATABASE_ID, CollectionId.LEADS, leadIds[i], {
			campaignId,
			status: LeadStatus.QUEUED,
			queuePosition: i + 1,
		});
	}
}
