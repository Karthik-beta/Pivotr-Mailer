/**
 * Settings Type Definitions
 */

import type { Models } from 'node-appwrite';

/**
 * Global Settings Document Structure
 */
export interface Settings extends Models.Document {
    // AWS SES Configuration
    awsSesRegion: string;
    awsSesAccessKeyId: string;
    awsSesSecretAccessKey: string;
    sesTimeoutMs: number;
    senderEmail: string;

    // AWS SQS Configuration (for Bounces/Complaints)
    awsSqsRegion: string;
    awsSqsQueueUrl: string;

    // Email Verifier Configuration
    myEmailVerifierApiKey: string;
    verifierTimeoutMs: number;

    // Retry Policy
    maxRetries: number;
    retryBackoffMs: number;

    // Unsubscribe Secret (for HMAC tokens)
    unsubscribeTokenSecret: string;
}

/**
 * Input type for updating settings
 */
export interface SettingsUpdateInput extends Partial<Omit<Settings, keyof Models.Document>> { }
