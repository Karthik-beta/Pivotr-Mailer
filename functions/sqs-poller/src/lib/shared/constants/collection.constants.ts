/**
 * Collection ID Constants
 *
 * Centralized mapping of all Appwrite Collection IDs, Database IDs, and Bucket IDs.
 * Used to avoid hardcoding strings throughout the codebase.
 */

// Database
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'pivotr_mailer';

// Collections
export const CollectionId = {
    CAMPAIGNS: 'campaigns',
    LEADS: 'leads',
    LOGS: 'logs',
    METRICS: 'metrics',
    SETTINGS: 'settings',
} as const;

// Buckets
export const BucketId = {
    IMPORTS: 'imports',
    EXPORTS: 'exports',
} as const;

// Document IDs (Singletons)
export const SETTINGS_DOCUMENT_ID = 'global_settings';
export const GLOBAL_METRICS_ID = 'global_metrics';

// Function IDs (Environmental)
export const FunctionId = {
    ORCHESTRATOR: process.env.ORCHESTRATOR_FUNCTION_ID || 'orchestrator',
    IMPORT_LEADS: process.env.IMPORT_LEADS_FUNCTION_ID || 'import-leads',
    EXPORT_LEADS: process.env.EXPORT_LEADS_FUNCTION_ID || 'export-leads',
} as const;

// System Constants
export const BATCH_SIZE = 100;
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Lock Constants
 */
export const LOCK_TTL_SECONDS = 300; // 5 minutes
export const STALE_LOCK_THRESHOLD_MS = 1000 * 60 * 10; // 10 minutes (double TTL)

/**
 * Processing Constants
 */
export const PROCESSING_TIMEOUT_MS = 1000 * 60 * 5; // 5 minutes
export const SENDING_TIMEOUT_MS = 1000 * 60 * 30; // 30 minutes (long timeout for SES)
