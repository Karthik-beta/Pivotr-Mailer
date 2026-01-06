/**
 * Log Repository
 *
 * Data access layer for the immutable logs collection (audit trail).
 * This collection is append-only - logs should never be updated or deleted.
 */

import type { Client, Models } from 'node-appwrite';
import { Databases, ID, Query } from 'node-appwrite';
import { CollectionId, DATABASE_ID } from '../../constants/collection.constants';
import type { EventTypeValue } from '../../constants/event.constants';
import { LogSeverity } from '../../constants/status.constants';
import type { Log, LogCreateInput } from '../../types/log.types';

/**
 * Convert Appwrite document to Log type
 */
function documentToLog(doc: Models.Document): Log {
    return doc as unknown as Log;
}

/**
 * Create a new log entry
 */
export async function createLog(client: Client, data: LogCreateInput): Promise<Log> {
    const databases = new Databases(client);

    // Serialize JSON fields to strings (Appwrite limitation)
    const serializedData = {
        ...data,
        templateVariables: data.templateVariables ? JSON.stringify(data.templateVariables) : null,
        verifierResponse: data.verifierResponse ? JSON.stringify(data.verifierResponse) : null,
        sesResponse: data.sesResponse ? JSON.stringify(data.sesResponse) : null,
        sqsMessage: data.sqsMessage ? JSON.stringify(data.sqsMessage) : null,
        errorDetails: data.errorDetails ? JSON.stringify(data.errorDetails) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    };

    const doc = await databases.createDocument(
        DATABASE_ID,
        CollectionId.LOGS,
        ID.unique(),
        serializedData
    );

    return documentToLog(doc);
}

/**
 * Helper to create INFO level log
 */
export async function logInfo(
    client: Client,
    eventType: EventTypeValue,
    message: string,
    options?: Partial<LogCreateInput>
): Promise<Log> {
    return createLog(client, {
        eventType,
        severity: LogSeverity.INFO,
        message,
        ...options,
    });
}

/**
 * Helper to create WARN level log
 */
export async function logWarn(
    client: Client,
    eventType: EventTypeValue,
    message: string,
    options?: Partial<LogCreateInput>
): Promise<Log> {
    return createLog(client, {
        eventType,
        severity: LogSeverity.WARN,
        message,
        ...options,
    });
}

/**
 * Helper to create ERROR level log
 */
export async function logError(
    client: Client,
    eventType: EventTypeValue,
    message: string,
    options?: Partial<LogCreateInput>
): Promise<Log> {
    return createLog(client, {
        eventType,
        severity: LogSeverity.ERROR,
        message,
        ...options,
    });
}

/**
 * Get logs for a specific lead
 */
export async function getLogsForLead(
    client: Client,
    leadId: string,
    limit: number = 100
): Promise<Log[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
        Query.equal('leadId', leadId),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
    ]);

    return result.documents.map(documentToLog);
}

/**
 * Get logs for a specific campaign
 */
export async function getLogsForCampaign(
    client: Client,
    campaignId: string,
    limit: number = 100
): Promise<Log[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
        Query.equal('campaignId', campaignId),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
    ]);

    return result.documents.map(documentToLog);
}

/**
 * Get recent logs by severity
 */
export async function getLogsBySeverity(
    client: Client,
    severity: string,
    limit: number = 100
): Promise<Log[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
        Query.equal('severity', severity),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
    ]);

    return result.documents.map(documentToLog);
}

/**
 * Get recent logs by event type
 */
export async function getLogsByEventType(
    client: Client,
    eventType: string,
    limit: number = 100
): Promise<Log[]> {
    const databases = new Databases(client);

    const result = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
        Query.equal('eventType', eventType),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
    ]);

    return result.documents.map(documentToLog);
}
