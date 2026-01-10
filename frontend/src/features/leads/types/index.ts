/**
 * Lead Types
 *
 * TypeScript interfaces for leads management.
 */

export type LeadStatus =
    | 'PENDING_IMPORT'
    | 'VERIFIED'
    | 'QUEUED'
    | 'SENT'
    | 'DELIVERED'
    | 'BOUNCED'
    | 'COMPLAINED'
    | 'FAILED'
    | 'SKIPPED_DAILY_CAP'
    | 'UNSUBSCRIBED';

export type StagingStatus = 'PENDING_REVIEW' | 'VALIDATED' | 'REJECTED' | 'APPROVED';

export type LeadType = 'HARDWARE' | 'SOFTWARE' | 'BOTH';

export interface Lead {
    id: string;
    fullName: string;
    email: string;
    companyName: string;
    phoneNumber?: string;
    leadType?: LeadType;
    status: LeadStatus;
    campaignId?: string;
    parsedFirstName?: string;
    createdAt: string;
    updatedAt: string;
    sentAt?: string;
    lastMessageId?: string;
}

export interface StagedLead {
    id: string;
    fullName: string;
    email: string;
    companyName: string;
    phoneNumber?: string;
    leadType?: LeadType;
    status: StagingStatus;
    validationResult: ValidationResult;
    parsedFirstName: string;
    createdAt: string;
    updatedAt: string;
    importBatchId?: string;
}

export interface ValidationError {
    field: 'fullName' | 'email' | 'companyName' | 'phoneNumber';
    code: string;
    message: string;
}

export interface ValidationWarning {
    field: 'fullName' | 'email' | 'companyName' | 'phoneNumber';
    code: string;
    message: string;
}

export interface NameValidationResult {
    valid: boolean;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    normalizedName: string;
    errors: string[];
    warnings: string[];
    metadata: {
        tokenCount: number;
        hasHonorific: boolean;
        hasSurname: boolean;
        hasInitials: boolean;
        detectedPattern: string;
    };
}

export interface EmailValidationResult {
    valid: boolean;
    normalized: string;
    domain: string;
    isDisposable: boolean;
    isCorporate: boolean;
    errors: string[];
}

export interface CompanyValidationResult {
    valid: boolean;
    normalized: string;
    errors: string[];
    warnings: string[];
}

export interface PhoneValidationResult {
    valid: boolean;
    normalized: string;
    errors: string[];
}

export interface ValidationResult {
    valid: boolean;
    lead: {
        fullName: string;
        email: string;
        companyName: string;
        phoneNumber?: string;
        leadType?: LeadType;
    };
    errors: ValidationError[];
    warnings: ValidationWarning[];
    nameValidation: NameValidationResult;
    emailValidation: EmailValidationResult;
    companyValidation: CompanyValidationResult;
    phoneValidation?: PhoneValidationResult;
}

// API Response Types
export interface LeadsResponse {
    success: boolean;
    data: Lead[];
    lastKey?: string | null;
    count?: number;
}

export interface StagedLeadsResponse {
    success: boolean;
    data: StagedLead[];
    count: number;
    lastKey?: string | null;
}

export interface StageLeadsRequest {
    leads: Array<{
        fullName: string;
        email: string;
        companyName: string;
        phoneNumber?: string;
        leadType?: LeadType;
    }>;
    batchId?: string;
}

export interface StageLeadsResponse {
    success: boolean;
    data: {
        batchId: string;
        totalCount: number;
        stagedCount: number;
        validCount: number;
        invalidCount: number;
        summary: {
            nameErrors: number;
            emailErrors: number;
            companyErrors: number;
            phoneErrors: number;
            corporateEmailCount: number;
            freeEmailCount: number;
        };
    };
}

export interface ApproveLeadResponse {
    success: boolean;
    data: {
        stagingId: string;
        leadId: string;
        lead: Lead;
    };
}

export interface BatchApproveResponse {
    success: boolean;
    data: {
        approved: number;
        skipped: number;
        failed: number;
        details: Array<{
            id: string;
            status: string;
            message: string;
        }>;
    };
}

// Status styling
export const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; border: string }> = {
    PENDING_IMPORT: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    VERIFIED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    QUEUED: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    SENT: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    DELIVERED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    BOUNCED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    COMPLAINED: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    FAILED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    SKIPPED_DAILY_CAP: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    UNSUBSCRIBED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export const STAGING_STATUS_COLORS: Record<StagingStatus, { bg: string; text: string; border: string }> = {
    PENDING_REVIEW: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    VALIDATED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    REJECTED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    APPROVED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};
