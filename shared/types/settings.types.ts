/**
 * Settings Document Interface
 * 
 * Singleton configuration document for system-wide settings.
 * Fixed document ID: "global_settings"
 */
export interface Settings {
    /** Fixed document ID: "global_settings" */
    $id: string;

    /** Document creation timestamp */
    $createdAt: string;

    /** Document last update timestamp */
    $updatedAt: string;

    /** AWS region for SES (e.g., "ap-south-1") */
    awsSesRegion: string;

    /** 
     * IAM access key for SES
     * NOTE: In production, prefer environment variables
     */
    awsSesAccessKeyId: string;

    /** 
     * IAM secret key for SES
     * NOTE: In production, prefer environment variables
     */
    awsSesSecretAccessKey: string;

    /** SQS queue URL for bounce/complaint feedback */
    awsSqsQueueUrl: string;

    /** AWS region for SQS */
    awsSqsRegion: string;

    /** 
     * MyEmailVerifier API key
     * NOTE: In production, prefer environment variables
     */
    myEmailVerifierApiKey: string;

    /** Default Gaussian minimum delay (milliseconds) */
    defaultMinDelayMs: number;

    /** Default Gaussian maximum delay (milliseconds) */
    defaultMaxDelayMs: number;

    /** SQS polling frequency (milliseconds) */
    sqsPollingIntervalMs: number;

    /** MyEmailVerifier API timeout (milliseconds) */
    verifierTimeoutMs: number;

    /** SES API timeout (milliseconds) */
    sesTimeoutMs: number;

    /** Retry count before marking as failed */
    maxRetries: number;

    /** Base backoff duration for retries (milliseconds) */
    retryBackoffMs: number;

    /** HMAC secret for unsubscribe link tokens */
    unsubscribeTokenSecret: string;
}

/**
 * Settings Update Input
 * 
 * Fields that can be updated on the settings document.
 */
export interface SettingsUpdateInput {
    awsSesRegion?: string;
    awsSesAccessKeyId?: string;
    awsSesSecretAccessKey?: string;
    awsSqsQueueUrl?: string;
    awsSqsRegion?: string;
    myEmailVerifierApiKey?: string;
    defaultMinDelayMs?: number;
    defaultMaxDelayMs?: number;
    sqsPollingIntervalMs?: number;
    verifierTimeoutMs?: number;
    sesTimeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    unsubscribeTokenSecret?: string;
}

/**
 * Default Settings Values
 * 
 * Sensible defaults for initial setup.
 */
export const DEFAULT_SETTINGS: Omit<Settings, '$id' | '$createdAt' | '$updatedAt'> = {
    awsSesRegion: 'ap-south-1',
    awsSesAccessKeyId: '',
    awsSesSecretAccessKey: '',
    awsSqsQueueUrl: '',
    awsSqsRegion: 'ap-south-1',
    myEmailVerifierApiKey: '',
    defaultMinDelayMs: 60000,    // 1 minute
    defaultMaxDelayMs: 180000,   // 3 minutes
    sqsPollingIntervalMs: 60000, // 1 minute
    verifierTimeoutMs: 10000,    // 10 seconds
    sesTimeoutMs: 30000,         // 30 seconds
    maxRetries: 3,
    retryBackoffMs: 1000,        // 1 second base
    unsubscribeTokenSecret: '',  // MUST be set before production use
};
