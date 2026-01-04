/**
 * Settings Repository
 * 
 * Data access layer for the singleton settings document.
 */

import { Databases } from 'node-appwrite';
import type { Client } from 'node-appwrite';
import {
    DATABASE_ID,
    CollectionId,
    SETTINGS_DOCUMENT_ID
} from '../../../../shared/constants/collection.constants';
import type { Settings, SettingsUpdateInput } from '../../../../shared/types/settings.types';

/**
 * Get global settings
 */
export async function getSettings(client: Client): Promise<Settings | null> {
    const databases = new Databases(client);

    try {
        const doc = await databases.getDocument(
            DATABASE_ID,
            CollectionId.SETTINGS,
            SETTINGS_DOCUMENT_ID
        );
        return doc as unknown as Settings;
    } catch {
        return null;
    }
}

/**
 * Update settings
 */
export async function updateSettings(
    client: Client,
    data: SettingsUpdateInput
): Promise<Settings> {
    const databases = new Databases(client);

    const doc = await databases.updateDocument(
        DATABASE_ID,
        CollectionId.SETTINGS,
        SETTINGS_DOCUMENT_ID,
        data
    );

    return doc as unknown as Settings;
}

/**
 * Get specific setting value
 */
export async function getSetting<K extends keyof Settings>(
    client: Client,
    key: K
): Promise<Settings[K] | null> {
    const settings = await getSettings(client);
    return settings ? settings[key] : null;
}

/**
 * Build SES configuration from settings
 */
export async function getSesConfig(client: Client) {
    const settings = await getSettings(client);
    if (!settings) throw new Error('Settings not found');

    return {
        region: settings.awsSesRegion,
        accessKeyId: settings.awsSesAccessKeyId,
        secretAccessKey: settings.awsSesSecretAccessKey,
        timeoutMs: settings.sesTimeoutMs,
        maxRetries: settings.maxRetries,
        retryBackoffMs: settings.retryBackoffMs,
    };
}

/**
 * Build SQS configuration from settings
 */
export async function getSqsConfig(client: Client) {
    const settings = await getSettings(client);
    if (!settings) throw new Error('Settings not found');

    return {
        region: settings.awsSqsRegion,
        accessKeyId: settings.awsSesAccessKeyId, // Shared credentials
        secretAccessKey: settings.awsSesSecretAccessKey,
        queueUrl: settings.awsSqsQueueUrl,
        waitTimeSeconds: 20,
        maxMessages: 10,
    };
}

/**
 * Build verifier configuration from settings
 */
export async function getVerifierConfig(client: Client) {
    const settings = await getSettings(client);
    if (!settings) throw new Error('Settings not found');

    return {
        apiKey: settings.myEmailVerifierApiKey,
        timeoutMs: settings.verifierTimeoutMs,
        maxRetries: settings.maxRetries,
        retryBackoffMs: settings.retryBackoffMs,
    };
}
