/**
 * Migration 008: Seed Initial Data
 * 
 * Creates the singleton documents required for system operation:
 * - Global settings document
 * - Global metrics document
 */
import { Client, Databases, ID } from 'node-appwrite';
import {
    DATABASE_ID,
    CollectionId,
    SETTINGS_DOCUMENT_ID,
    GLOBAL_METRICS_ID
} from '../shared/constants/collection.constants';
import { MetricsScope } from '../shared/constants/status.constants';
import { DEFAULT_SETTINGS } from '../shared/types/settings.types';

export async function seedInitialData(client: Client): Promise<void> {
    const databases = new Databases(client);

    console.log('Seeding initial data...');

    // ===== CREATE GLOBAL SETTINGS =====
    try {
        await databases.getDocument(DATABASE_ID, CollectionId.SETTINGS, SETTINGS_DOCUMENT_ID);
        console.log('Global settings document already exists. Skipping.');
    } catch {
        await databases.createDocument(
            DATABASE_ID,
            CollectionId.SETTINGS,
            SETTINGS_DOCUMENT_ID,
            {
                ...DEFAULT_SETTINGS,
                // Generate a random unsubscribe token secret
                unsubscribeTokenSecret: generateSecureToken(64),
            }
        );
        console.log('Created global settings document.');
    }

    // ===== CREATE GLOBAL METRICS =====
    try {
        await databases.getDocument(DATABASE_ID, CollectionId.METRICS, GLOBAL_METRICS_ID);
        console.log('Global metrics document already exists. Skipping.');
    } catch {
        await databases.createDocument(
            DATABASE_ID,
            CollectionId.METRICS,
            GLOBAL_METRICS_ID,
            {
                scope: MetricsScope.GLOBAL,
                scopeId: null,
                totalLeadsImported: 0,
                totalEmailsSent: 0,
                totalBounces: 0,
                totalHardBounces: 0,
                totalSoftBounces: 0,
                totalComplaints: 0,
                totalVerificationPassed: 0,
                totalVerificationFailed: 0,
                totalSkipped: 0,
                totalErrors: 0,
                verifierCreditsUsed: 0,
                lastUpdatedAt: new Date().toISOString(),
            }
        );
        console.log('Created global metrics document.');
    }

    console.log('Initial data seeding complete.');
}

/**
 * Generate a cryptographically secure random token
 */
function generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

/**
 * Appwrite Console Instructions (Manual)
 * 
 * 1. Create Settings Document:
 *    - Collection: settings
 *    - Document ID: global_settings
 *    - Fill in all required fields with appropriate values
 *    - IMPORTANT: Generate a secure random string for unsubscribeTokenSecret
 * 
 * 2. Create Global Metrics Document:
 *    - Collection: metrics
 *    - Document ID: global_metrics
 *    - scope: GLOBAL
 *    - scopeId: (leave empty)
 *    - All counters: 0
 *    - lastUpdatedAt: current timestamp
 */
