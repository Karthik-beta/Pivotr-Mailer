/**
 * Appwrite Collection Constants
 *
 * Contains database and collection IDs for Appwrite.
 * Update these values after creating collections in Appwrite Console.
 */

/** Database ID for Pivotr Mailer */
export const DATABASE_ID = "pivotr_mailer";

/** Collection IDs */
export const CollectionId = {
    LEADS: "leads",
    STAGED_LEADS: "staged_leads",
    CAMPAIGNS: "campaigns",
    LOGS: "logs",
    METRICS: "metrics",
    SETTINGS: "settings",
} as const;

export type CollectionIdType = (typeof CollectionId)[keyof typeof CollectionId];

/** Storage Bucket IDs */
export const BucketId = {
    LEAD_IMPORTS: "lead-imports",
} as const;

/**
 * Settings Document ID
 *
 * The settings collection uses a singleton pattern with a fixed document ID.
 */
export const SETTINGS_DOCUMENT_ID = "global_settings";

/**
 * Global Metrics Document ID
 *
 * The global metrics document uses a fixed ID.
 */
export const GLOBAL_METRICS_ID = "global_metrics";

/**
 * Redis Key Prefixes for Campaign Locking
 */
export const RedisKeyPrefix = {
    CAMPAIGN_LOCK: "pivotr:lock:campaign:",
} as const;

/**
 * Lock TTL in seconds
 */
export const LOCK_TTL_SECONDS = 120;

/**
 * Lock refresh interval in milliseconds
 */
export const LOCK_REFRESH_INTERVAL_MS = 30000;

/**
 * SENDING status timeout in milliseconds
 * Leads stuck in SENDING longer than this should be recovered
 */
export const SENDING_TIMEOUT_MS = 60000;

/**
 * Stale lock threshold in milliseconds
 * Locks older than this can be forcefully released during recovery
 */
export const STALE_LOCK_THRESHOLD_MS = 300000; // 5 minutes
