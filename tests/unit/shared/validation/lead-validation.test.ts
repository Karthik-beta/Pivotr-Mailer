/**
 * Unit Tests: Lead Validation
 *
 * Tests validation logic for lead data.
 * No AWS services are used in these tests.
 */

import { describe, it, expect, vi } from 'vitest';

// =============================================================================
// Validation Logic (extracted for testing)
// =============================================================================

/**
 * Email validation regex (matches API Lambda logic)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate required lead fields
 */
function validateLeadFields(lead: {
    fullName?: string;
    email?: string;
    companyName?: string;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!lead.fullName?.trim()) {
        errors.push('fullName is required');
    }

    if (!lead.email?.trim()) {
        errors.push('email is required');
    } else if (!isValidEmail(lead.email)) {
        errors.push('Invalid email format');
    }

    if (!lead.companyName?.trim()) {
        errors.push('companyName is required');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate lead status transitions
 */
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
        PENDING_IMPORT: ['QUEUED', 'VERIFIED', 'SKIPPED'],
        QUEUED: ['SENT', 'SKIPPED', 'SKIPPED_DAILY_CAP', 'FAILED'],
        VERIFIED: ['QUEUED', 'SKIPPED'],
        SENT: ['DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED'],
        DELIVERED: [], // Terminal state
        BOUNCED: [], // Terminal state
        COMPLAINED: [], // Terminal state
        SKIPPED: [], // Terminal state
        SKIPPED_DAILY_CAP: ['QUEUED'], // Can be retried
        FAILED: ['QUEUED'], // Can be retried
    };

    const allowed = validTransitions[currentStatus] || [];
    return allowed.includes(newStatus);
}

// =============================================================================
// Tests
// =============================================================================

describe('Lead Validation', () => {
    describe('isValidEmail', () => {
        it('should accept valid email addresses', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co',
                'user+tag@example.org',
                'first.last@subdomain.domain.com',
                '123@numbers.com',
            ];

            for (const email of validEmails) {
                expect(isValidEmail(email)).toBe(true);
            }
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                '',
                'notanemail',
                '@missing-local.com',
                'missing@.domain',
                'missing@domain.',
                'spaces in@email.com',
                'no@domain',
                'double@@at.com',
            ];

            for (const email of invalidEmails) {
                expect(isValidEmail(email)).toBe(false);
            }
        });

        it('should handle null and undefined', () => {
            expect(isValidEmail(null as any)).toBe(false);
            expect(isValidEmail(undefined as any)).toBe(false);
        });

        it('should trim whitespace before validation', () => {
            expect(isValidEmail('  test@example.com  ')).toBe(true);
        });
    });

    describe('validateLeadFields', () => {
        it('should validate a complete lead', () => {
            const result = validateLeadFields({
                fullName: 'John Doe',
                email: 'john@example.com',
                companyName: 'Acme Corp',
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should require fullName', () => {
            const result = validateLeadFields({
                email: 'john@example.com',
                companyName: 'Acme Corp',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('fullName is required');
        });

        it('should require email', () => {
            const result = validateLeadFields({
                fullName: 'John Doe',
                companyName: 'Acme Corp',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('email is required');
        });

        it('should require valid email format', () => {
            const result = validateLeadFields({
                fullName: 'John Doe',
                email: 'not-an-email',
                companyName: 'Acme Corp',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid email format');
        });

        it('should require companyName', () => {
            const result = validateLeadFields({
                fullName: 'John Doe',
                email: 'john@example.com',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('companyName is required');
        });

        it('should collect multiple errors', () => {
            const result = validateLeadFields({});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(3);
        });

        it('should reject whitespace-only values', () => {
            const result = validateLeadFields({
                fullName: '   ',
                email: '   ',
                companyName: '   ',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('fullName is required');
            expect(result.errors).toContain('email is required');
            expect(result.errors).toContain('companyName is required');
        });
    });

    describe('isValidStatusTransition', () => {
        it('should allow PENDING_IMPORT to QUEUED', () => {
            expect(isValidStatusTransition('PENDING_IMPORT', 'QUEUED')).toBe(true);
        });

        it('should allow PENDING_IMPORT to VERIFIED', () => {
            expect(isValidStatusTransition('PENDING_IMPORT', 'VERIFIED')).toBe(true);
        });

        it('should allow QUEUED to SENT', () => {
            expect(isValidStatusTransition('QUEUED', 'SENT')).toBe(true);
        });

        it('should allow QUEUED to SKIPPED_DAILY_CAP', () => {
            expect(isValidStatusTransition('QUEUED', 'SKIPPED_DAILY_CAP')).toBe(true);
        });

        it('should allow SENT to DELIVERED', () => {
            expect(isValidStatusTransition('SENT', 'DELIVERED')).toBe(true);
        });

        it('should allow SENT to BOUNCED', () => {
            expect(isValidStatusTransition('SENT', 'BOUNCED')).toBe(true);
        });

        it('should allow SENT to COMPLAINED', () => {
            expect(isValidStatusTransition('SENT', 'COMPLAINED')).toBe(true);
        });

        it('should allow FAILED to QUEUED (retry)', () => {
            expect(isValidStatusTransition('FAILED', 'QUEUED')).toBe(true);
        });

        it('should allow SKIPPED_DAILY_CAP to QUEUED (retry)', () => {
            expect(isValidStatusTransition('SKIPPED_DAILY_CAP', 'QUEUED')).toBe(true);
        });

        it('should NOT allow DELIVERED to any status', () => {
            expect(isValidStatusTransition('DELIVERED', 'QUEUED')).toBe(false);
            expect(isValidStatusTransition('DELIVERED', 'SENT')).toBe(false);
            expect(isValidStatusTransition('DELIVERED', 'BOUNCED')).toBe(false);
        });

        it('should NOT allow BOUNCED to any status', () => {
            expect(isValidStatusTransition('BOUNCED', 'QUEUED')).toBe(false);
            expect(isValidStatusTransition('BOUNCED', 'SENT')).toBe(false);
        });

        it('should NOT allow COMPLAINED to any status', () => {
            expect(isValidStatusTransition('COMPLAINED', 'QUEUED')).toBe(false);
            expect(isValidStatusTransition('COMPLAINED', 'SENT')).toBe(false);
        });

        it('should NOT allow skipping steps', () => {
            expect(isValidStatusTransition('PENDING_IMPORT', 'SENT')).toBe(false);
            expect(isValidStatusTransition('PENDING_IMPORT', 'DELIVERED')).toBe(false);
        });

        it('should NOT allow invalid reverse transitions', () => {
            expect(isValidStatusTransition('SENT', 'QUEUED')).toBe(false);
            expect(isValidStatusTransition('DELIVERED', 'PENDING_IMPORT')).toBe(false);
        });
    });
});
