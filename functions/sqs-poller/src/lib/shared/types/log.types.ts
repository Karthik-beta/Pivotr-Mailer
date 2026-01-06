/**
 * Log Type Definitions
 */

import type { Models } from 'node-appwrite';
import type { EventTypeValue } from '../constants/event.constants';
import type { LogSeverityValue } from '../constants/status.constants';

/**
 * Log Document Structure
 */
export interface Log extends Models.Document {
    // Event Context
    eventType: EventTypeValue;
    severity: LogSeverityValue;
    message: string;

    // Related Entities
    campaignId?: string;
    leadId?: string;

    // Serialization Helper Fields (since Appwrite lacks complex objects)
    // These contain JSON strings
    templateVariables?: string | null;
    verifierResponse?: string | null;
    sesResponse?: string | null;
    sqsMessage?: string | null;
    errorDetails?: string | null;
    metadata?: string | null;
}

/**
 * Input for creating a log
 * This allows passing objects that will be JSON serialized by the repository
 */
export interface LogCreateInput {
    eventType: EventTypeValue;
    severity: LogSeverityValue;
    message: string;
    campaignId?: string;
    leadId?: string;

    // Objects to be serialized by repository
    templateVariables?: Record<string, unknown>;
    verifierResponse?: Record<string, unknown>;
    sesResponse?: Record<string, unknown>;
    sqsMessage?: Record<string, unknown>;
    errorDetails?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
