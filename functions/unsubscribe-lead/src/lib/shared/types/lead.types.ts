/**
 * Lead Type Definitions
 */

import type { Models } from 'node-appwrite';
import type { LeadStatusValue, VerificationResultValue } from '../constants/status.constants';

/**
 * Lead Document Structure
 */
export interface Lead extends Models.Document {
    // Core Identity
    email: string;
    firstName?: string;
    lastName?: string;
    fullName: string;
    parsedFirstName?: string; // High-confidence extracted first name
    parsedLastName?: string;

    // Company Info
    companyName: string;
    website?: string;
    phone?: string;
    location?: string;
    designation?: string;
    industry?: string;

    // Campaign Association
    campaignId?: string; // ID of the campaign this lead is queued for
    queuePosition?: number; // Sorting order within campaign

    // Status & Pipeline
    status: LeadStatusValue;
    processingStartedAt?: string | null;
    processedAt?: string | null;

    // Verification Data
    verificationResult?: VerificationResultValue;
    verificationTimestamp?: string | null;
    verifierResponse?: string; // JSON string of raw response

    // Engagement Data
    sesMessageId?: string;
    bounceType?: string;
    bounceSubType?: string;
    complaintFeedbackType?: string;
    isUnsubscribed: boolean;
    unsubscribedAt?: string | null;

    // Errors
    errorMessage?: string;
    errorCount: number;

    // Metadata
    importBatchId?: string;
    source?: string;
    notes?: string;
}

/**
 * Input type for creating a Lead
 */
export interface LeadCreateInput {
    email: string;
    fullName: string;
    companyName: string;
    status?: LeadStatusValue;
    firstName?: string;
    lastName?: string;
    website?: string;
    phone?: string;
    location?: string;
    designation?: string;
    industry?: string;
    importBatchId?: string;
    source?: string;
    notes?: string;
}

/**
 * Input type for updating a Lead
 */
export interface LeadUpdateInput extends Partial<Omit<LeadCreateInput, 'email'>> {
    status?: LeadStatusValue;
    campaignId?: string | null;
    queuePosition?: number;
    processingStartedAt?: string | null;
    processedAt?: string | null;
    verificationResult?: VerificationResultValue;
    verificationTimestamp?: string | null;
    verifierResponse?: string;
    parsedFirstName?: string;
    parsedLastName?: string;
    sesMessageId?: string;
    bounceType?: string | null;
    bounceSubType?: string | null;
    complaintFeedbackType?: string | null;
    isUnsubscribed?: boolean;
    unsubscribedAt?: string | null;
    errorMessage?: string;
    errorCount?: number;
}
