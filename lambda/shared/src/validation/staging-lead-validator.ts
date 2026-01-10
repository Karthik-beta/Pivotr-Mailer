/**
 * Staging Lead Validator
 *
 * Comprehensive validation for leads during staging phase.
 * All leads must pass validation before approval to main leads table.
 *
 * Validates:
 * - Indian names (using sophisticated name validator)
 * - Email addresses (format, domain, disposable detection)
 * - Company names (format, suspicious patterns)
 * - Phone numbers (Indian format)
 */

import { validateIndianName, type NameValidationResult } from './indian-name-validator';

// =============================================================================
// Types
// =============================================================================

export interface StagedLead {
    readonly fullName: string;
    readonly email: string;
    readonly companyName: string;
    readonly phoneNumber?: string;
    readonly leadType?: 'HARDWARE' | 'SOFTWARE' | 'BOTH';
}

export interface LeadValidationResult {
    readonly valid: boolean;
    readonly lead: StagedLead;
    readonly errors: readonly ValidationError[];
    readonly warnings: readonly ValidationWarning[];
    readonly nameValidation: NameValidationResult;
    readonly emailValidation: EmailValidationResult;
    readonly companyValidation: CompanyValidationResult;
    readonly phoneValidation?: PhoneValidationResult;
}

export interface ValidationError {
    readonly field: 'fullName' | 'email' | 'companyName' | 'phoneNumber';
    readonly code: string;
    readonly message: string;
}

export interface ValidationWarning {
    readonly field: 'fullName' | 'email' | 'companyName' | 'phoneNumber';
    readonly code: string;
    readonly message: string;
}

export interface EmailValidationResult {
    readonly valid: boolean;
    readonly normalized: string;
    readonly domain: string;
    readonly isDisposable: boolean;
    readonly isCorporate: boolean;
    readonly errors: readonly string[];
}

export interface CompanyValidationResult {
    readonly valid: boolean;
    readonly normalized: string;
    readonly errors: readonly string[];
    readonly warnings: readonly string[];
}

export interface PhoneValidationResult {
    readonly valid: boolean;
    readonly normalized: string;
    readonly errors: readonly string[];
}

// =============================================================================
// Email Validation
// =============================================================================

// Basic email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Common disposable email domains (partial list)
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'temp-mail.org', 'fakeinbox.com', 'getnada.com', 'tempail.com',
    '10minutemail.com', 'yopmail.com', 'trashmail.com', 'maildrop.cc',
    'mailnesia.com', 'sharklasers.com', 'grr.la', 'dispostable.com',
]);

// Common Indian corporate email domains
const INDIAN_CORPORATE_DOMAINS = new Set([
    // Major IT companies
    'tcs.com', 'infosys.com', 'wipro.com', 'hcl.com', 'techmahindra.com',
    'cognizant.com', 'mindtree.com', 'ltimindtree.com', 'mphasis.com',
    // Banks
    'hdfcbank.com', 'icicibank.com', 'sbi.co.in', 'axisbank.com', 'kotak.com',
    // Telecom
    'airtel.com', 'jio.com', 'vodafone.in', 'bharti.in',
    // Conglomerates
    'tata.com', 'reliance.com', 'adani.com', 'mahindra.com', 'birla.com',
    // E-commerce
    'flipkart.com', 'amazon.in', 'paytm.com', 'phonepe.com', 'swiggy.com', 'zomato.com',
]);

// Free email providers (valid but lower quality for B2B)
const FREE_EMAIL_PROVIDERS = new Set([
    'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'hotmail.com',
    'outlook.com', 'live.com', 'rediffmail.com', 'aol.com', 'icloud.com',
    'protonmail.com', 'zoho.com', 'mail.com',
]);

/**
 * Validate email address for Indian B2B leads
 */
export function validateEmail(email: string): EmailValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== 'string') {
        return {
            valid: false,
            normalized: '',
            domain: '',
            isDisposable: false,
            isCorporate: false,
            errors: ['Email is required'],
        };
    }

    const trimmed = email.trim().toLowerCase();

    // Length check
    if (trimmed.length < 5) {
        errors.push('Email too short');
    }

    if (trimmed.length > 254) {
        errors.push('Email too long');
    }

    // Format check
    if (!EMAIL_REGEX.test(trimmed)) {
        errors.push('Invalid email format');
    }

    // Extract domain
    const atIndex = trimmed.lastIndexOf('@');
    const domain = atIndex > 0 ? trimmed.slice(atIndex + 1) : '';

    if (!domain) {
        errors.push('Invalid email domain');
    }

    // Check for valid TLD
    if (domain && !domain.includes('.')) {
        errors.push('Email domain must have a valid TLD');
    }

    // Check for disposable email
    const isDisposable = DISPOSABLE_EMAIL_DOMAINS.has(domain);
    if (isDisposable) {
        errors.push('Disposable email addresses are not allowed');
    }

    // Check if corporate
    const isCorporate = INDIAN_CORPORATE_DOMAINS.has(domain) ||
                        (!FREE_EMAIL_PROVIDERS.has(domain) && !isDisposable && domain.endsWith('.in'));

    return {
        valid: errors.length === 0,
        normalized: trimmed,
        domain,
        isDisposable,
        isCorporate,
        errors,
    };
}

// =============================================================================
// Company Name Validation
// =============================================================================

const MIN_COMPANY_LENGTH = 2;
const MAX_COMPANY_LENGTH = 200;

// Valid characters for company names
const VALID_COMPANY_PATTERN = /^[A-Za-z0-9\u00C0-\u024F\s.,'&()@#\-\/]+$/;

// Suspicious patterns for company names
const SUSPICIOUS_COMPANY_PATTERNS = [
    /^(test|demo|sample|dummy|fake|na|n\/a|none|null|undefined)$/i,
    /^[0-9]+$/,                           // All numbers
    /^[a-z]$/i,                           // Single letter
    /(.)\1{4,}/i,                         // Same character 5+ times
    /^(self|individual|personal|private|freelance|freelancer)$/i, // Not a company
];

// Common Indian company suffixes
const INDIAN_COMPANY_SUFFIXES = [
    'pvt ltd', 'private limited', 'pvt. ltd.', 'pvt. ltd', 'private ltd',
    'ltd', 'limited', 'llp', 'llc', 'inc', 'incorporated', 'corp', 'corporation',
    'enterprises', 'enterprise', 'industries', 'industry', 'solutions', 'services',
    'technologies', 'technology', 'tech', 'infotech', 'infosystems', 'systems',
    'consultants', 'consulting', 'associates', 'group', 'holdings', 'ventures',
];

/**
 * Validate company name for Indian B2B leads
 */
export function validateCompanyName(companyName: string): CompanyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!companyName || typeof companyName !== 'string') {
        return {
            valid: false,
            normalized: '',
            errors: ['Company name is required'],
            warnings: [],
        };
    }

    const trimmed = companyName.trim();

    // Length check
    if (trimmed.length < MIN_COMPANY_LENGTH) {
        errors.push(`Company name too short (minimum ${MIN_COMPANY_LENGTH} characters)`);
    }

    if (trimmed.length > MAX_COMPANY_LENGTH) {
        errors.push(`Company name too long (maximum ${MAX_COMPANY_LENGTH} characters)`);
    }

    // Character validation
    if (!VALID_COMPANY_PATTERN.test(trimmed)) {
        errors.push('Company name contains invalid characters');
    }

    // Suspicious pattern check
    for (const pattern of SUSPICIOUS_COMPANY_PATTERNS) {
        if (pattern.test(trimmed)) {
            errors.push('Invalid company name');
            break;
        }
    }

    // Normalize the company name
    const normalized = normalizeCompanyName(trimmed);

    // Check for common company suffix (warning only, not required)
    const hasCompanySuffix = INDIAN_COMPANY_SUFFIXES.some(suffix =>
        normalized.toLowerCase().includes(suffix)
    );

    if (!hasCompanySuffix && errors.length === 0) {
        warnings.push('Company name may be incomplete (missing Pvt Ltd, LLP, etc.)');
    }

    return {
        valid: errors.length === 0,
        normalized,
        errors,
        warnings,
    };
}

function normalizeCompanyName(name: string): string {
    return name
        .replace(/\s+/g, ' ')
        .trim();
}

// =============================================================================
// Phone Number Validation (Indian Format)
// =============================================================================

// Indian phone number patterns
const INDIAN_MOBILE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;
const INDIAN_LANDLINE_REGEX = /^(?:\+91|91|0)?[1-9]\d{9,10}$/;

/**
 * Validate Indian phone number
 */
export function validatePhoneNumber(phoneNumber: string | undefined): PhoneValidationResult | undefined {
    if (!phoneNumber) {
        return undefined; // Phone is optional
    }

    const errors: string[] = [];

    // Remove common formatting characters
    const cleaned = phoneNumber.replace(/[\s\-().]/g, '');

    if (cleaned.length < 10) {
        errors.push('Phone number too short');
    }

    if (cleaned.length > 15) {
        errors.push('Phone number too long');
    }

    // Check Indian mobile or landline format
    const isMobile = INDIAN_MOBILE_REGEX.test(cleaned);
    const isLandline = INDIAN_LANDLINE_REGEX.test(cleaned);

    if (!isMobile && !isLandline) {
        errors.push('Invalid Indian phone number format');
    }

    // Normalize to +91 format
    let normalized = cleaned;
    if (normalized.startsWith('+91')) {
        // Already correct
    } else if (normalized.startsWith('91') && normalized.length === 12) {
        normalized = '+' + normalized;
    } else if (normalized.startsWith('0') && normalized.length === 11) {
        normalized = '+91' + normalized.slice(1);
    } else if (normalized.length === 10) {
        normalized = '+91' + normalized;
    }

    return {
        valid: errors.length === 0,
        normalized,
        errors,
    };
}

// =============================================================================
// Main Staging Lead Validator
// =============================================================================

/**
 * Validate a lead for staging approval
 *
 * @param lead - The lead to validate
 * @returns Comprehensive validation result
 */
export function validateStagedLead(lead: StagedLead): LeadValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    // Validate name
    const nameValidation = validateIndianName(lead.fullName);
    if (!nameValidation.valid) {
        nameValidation.errors.forEach(err => {
            allErrors.push({ field: 'fullName', code: 'INVALID_NAME', message: err });
        });
    }
    nameValidation.warnings.forEach(warn => {
        allWarnings.push({ field: 'fullName', code: 'NAME_WARNING', message: warn });
    });

    // Validate email
    const emailValidation = validateEmail(lead.email);
    if (!emailValidation.valid) {
        emailValidation.errors.forEach(err => {
            allErrors.push({ field: 'email', code: 'INVALID_EMAIL', message: err });
        });
    }
    if (!emailValidation.isCorporate && emailValidation.valid) {
        allWarnings.push({
            field: 'email',
            code: 'FREE_EMAIL',
            message: 'Using free email provider (not corporate)',
        });
    }

    // Validate company name
    const companyValidation = validateCompanyName(lead.companyName);
    if (!companyValidation.valid) {
        companyValidation.errors.forEach(err => {
            allErrors.push({ field: 'companyName', code: 'INVALID_COMPANY', message: err });
        });
    }
    companyValidation.warnings.forEach(warn => {
        allWarnings.push({ field: 'companyName', code: 'COMPANY_WARNING', message: warn });
    });

    // Validate phone (optional)
    const phoneValidation = validatePhoneNumber(lead.phoneNumber);
    if (phoneValidation && !phoneValidation.valid) {
        phoneValidation.errors.forEach(err => {
            allErrors.push({ field: 'phoneNumber', code: 'INVALID_PHONE', message: err });
        });
    }

    return {
        valid: allErrors.length === 0,
        lead,
        errors: allErrors,
        warnings: allWarnings,
        nameValidation,
        emailValidation,
        companyValidation,
        phoneValidation,
    };
}

// =============================================================================
// Batch Validation
// =============================================================================

export interface BatchLeadValidationResult {
    readonly totalCount: number;
    readonly validCount: number;
    readonly invalidCount: number;
    readonly results: readonly LeadValidationResult[];
    readonly summary: ValidationSummary;
}

export interface ValidationSummary {
    readonly nameErrors: number;
    readonly emailErrors: number;
    readonly companyErrors: number;
    readonly phoneErrors: number;
    readonly corporateEmailCount: number;
    readonly freeEmailCount: number;
}

/**
 * Validate multiple leads for batch staging
 */
export function validateStagedLeads(leads: readonly StagedLead[]): BatchLeadValidationResult {
    const results = leads.map(validateStagedLead);

    let nameErrors = 0;
    let emailErrors = 0;
    let companyErrors = 0;
    let phoneErrors = 0;
    let corporateEmailCount = 0;
    let freeEmailCount = 0;

    for (const result of results) {
        if (!result.nameValidation.valid) nameErrors++;
        if (!result.emailValidation.valid) emailErrors++;
        if (!result.companyValidation.valid) companyErrors++;
        if (result.phoneValidation && !result.phoneValidation.valid) phoneErrors++;
        if (result.emailValidation.isCorporate) corporateEmailCount++;
        if (!result.emailValidation.isCorporate && result.emailValidation.valid) freeEmailCount++;
    }

    const validCount = results.filter(r => r.valid).length;

    return {
        totalCount: leads.length,
        validCount,
        invalidCount: leads.length - validCount,
        results,
        summary: {
            nameErrors,
            emailErrors,
            companyErrors,
            phoneErrors,
            corporateEmailCount,
            freeEmailCount,
        },
    };
}
