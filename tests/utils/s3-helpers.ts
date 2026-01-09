/**
 * S3 Test Helpers
 *
 * Utility functions for S3 operations in integration tests.
 * Provides helpers for audit log testing and bucket operations.
 */

import {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    DeleteObjectsCommand,
    CreateBucketCommand,
    HeadBucketCommand,
    PutBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';
import { getS3Client, getS3Buckets } from './aws-clients.js';

const s3Client = getS3Client();
const buckets = getS3Buckets();

/**
 * Audit log entry structure matching production format
 */
export interface AuditLogEntry {
    timestamp: string;
    leadId: string;
    campaignId: string;
    email: string;
    action: 'SEND' | 'BOUNCE' | 'COMPLAINT' | 'DELIVERY';
    sesMessageId?: string;
    resolvedSubject?: string;
    resolvedBody?: string;
    templateVariables?: Record<string, string>;
    sesResponse?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Check if a bucket exists
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
        return true;
    } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'NotFound' || err.name === 'NoSuchBucket') {
            return false;
        }
        throw error;
    }
}

/**
 * Create a bucket if it doesn't exist
 */
export async function ensureBucketExists(bucketName: string): Promise<void> {
    if (await bucketExists(bucketName)) {
        return;
    }

    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
}

/**
 * Put an object in S3
 */
export async function putObject(
    key: string,
    body: string | Buffer,
    options: {
        bucket?: string;
        contentType?: string;
        metadata?: Record<string, string>;
    } = {}
): Promise<void> {
    const bucket = options.bucket || buckets.auditLogs;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: typeof body === 'string' ? body : body,
            ContentType: options.contentType || 'application/json',
            Metadata: options.metadata,
        })
    );
}

/**
 * Get an object from S3
 */
export async function getObject(
    key: string,
    bucket?: string
): Promise<string | null> {
    try {
        const response = await s3Client.send(
            new GetObjectCommand({
                Bucket: bucket || buckets.auditLogs,
                Key: key,
            })
        );

        if (!response.Body) {
            return null;
        }

        return await response.Body.transformToString();
    } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'NoSuchKey') {
            return null;
        }
        throw error;
    }
}

/**
 * Get an object as parsed JSON
 */
export async function getObjectJSON<T>(
    key: string,
    bucket?: string
): Promise<T | null> {
    const content = await getObject(key, bucket);
    if (!content) {
        return null;
    }
    return JSON.parse(content) as T;
}

/**
 * Check if an object exists
 */
export async function objectExists(
    key: string,
    bucket?: string
): Promise<boolean> {
    try {
        await s3Client.send(
            new HeadObjectCommand({
                Bucket: bucket || buckets.auditLogs,
                Key: key,
            })
        );
        return true;
    } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'NotFound') {
            return false;
        }
        throw error;
    }
}

/**
 * Delete an object from S3
 */
export async function deleteObject(
    key: string,
    bucket?: string
): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: bucket || buckets.auditLogs,
            Key: key,
        })
    );
}

/**
 * List objects in a bucket with optional prefix
 */
export async function listObjects(
    prefix?: string,
    bucket?: string
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const response = await s3Client.send(
        new ListObjectsV2Command({
            Bucket: bucket || buckets.auditLogs,
            Prefix: prefix,
        })
    );

    return (response.Contents || []).map((obj) => ({
        key: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
    }));
}

/**
 * Delete all objects with a prefix
 */
export async function deleteObjectsByPrefix(
    prefix: string,
    bucket?: string
): Promise<number> {
    const bucketName = bucket || buckets.auditLogs;
    const objects = await listObjects(prefix, bucketName);

    if (objects.length === 0) {
        return 0;
    }

    await s3Client.send(
        new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
                Objects: objects.map((obj) => ({ Key: obj.key })),
            },
        })
    );

    return objects.length;
}

/**
 * Clear all objects from the audit logs bucket
 */
export async function clearAuditLogsBucket(): Promise<number> {
    return deleteObjectsByPrefix('', buckets.auditLogs);
}

/**
 * Store an audit log entry
 * Uses the production key format: {year}/{month}/{day}/{campaignId}/{leadId}-{timestamp}.json
 */
export async function storeAuditLog(entry: AuditLogEntry): Promise<string> {
    const date = new Date(entry.timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const ts = date.getTime();

    const key = `${year}/${month}/${day}/${entry.campaignId}/${entry.leadId}-${ts}.json`;

    await putObject(key, JSON.stringify(entry, null, 2), {
        metadata: {
            'lead-id': entry.leadId,
            'campaign-id': entry.campaignId,
            action: entry.action,
        },
    });

    return key;
}

/**
 * Get audit logs for a specific date
 */
export async function getAuditLogsForDate(
    date: Date
): Promise<AuditLogEntry[]> {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const prefix = `${year}/${month}/${day}/`;
    const objects = await listObjects(prefix);

    const entries: AuditLogEntry[] = [];
    for (const obj of objects) {
        const entry = await getObjectJSON<AuditLogEntry>(obj.key);
        if (entry) {
            entries.push(entry);
        }
    }

    return entries;
}

/**
 * Get audit logs for a specific campaign
 */
export async function getAuditLogsForCampaign(
    campaignId: string,
    date: Date
): Promise<AuditLogEntry[]> {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    const prefix = `${year}/${month}/${day}/${campaignId}/`;
    const objects = await listObjects(prefix);

    const entries: AuditLogEntry[] = [];
    for (const obj of objects) {
        const entry = await getObjectJSON<AuditLogEntry>(obj.key);
        if (entry) {
            entries.push(entry);
        }
    }

    return entries;
}

/**
 * Create a test audit log entry with defaults
 */
export function createAuditLogEntry(
    overrides: Partial<AuditLogEntry> = {}
): AuditLogEntry {
    return {
        timestamp: new Date().toISOString(),
        leadId: `lead-${Date.now()}`,
        campaignId: `campaign-${Date.now()}`,
        email: 'test@example.com',
        action: 'SEND',
        sesMessageId: `ses-${Date.now()}`,
        resolvedSubject: 'Test Email Subject',
        resolvedBody: '<p>Test email body</p>',
        templateVariables: {
            firstName: 'Test',
            company: 'Test Company',
        },
        ...overrides,
    };
}

/**
 * Configure lifecycle rules (for testing lifecycle configuration)
 * Note: LocalStack has limited lifecycle support
 */
export async function configureLifecycleRules(
    bucket?: string
): Promise<void> {
    await s3Client.send(
        new PutBucketLifecycleConfigurationCommand({
            Bucket: bucket || buckets.auditLogs,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: 'MoveToIA',
                        Status: 'Enabled',
                        Filter: { Prefix: '' },
                        Transitions: [
                            {
                                Days: 30,
                                StorageClass: 'STANDARD_IA',
                            },
                        ],
                    },
                    {
                        ID: 'MoveToGlacier',
                        Status: 'Enabled',
                        Filter: { Prefix: '' },
                        Transitions: [
                            {
                                Days: 365,
                                StorageClass: 'GLACIER',
                            },
                        ],
                    },
                    {
                        ID: 'DeleteAfter7Years',
                        Status: 'Enabled',
                        Filter: { Prefix: '' },
                        Expiration: {
                            Days: 2555,
                        },
                    },
                ],
            },
        })
    );
}
