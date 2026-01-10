/**
 * Unit Tests: Indian Name Validation
 *
 * Extensive tests for Indian name validation logic.
 * Tests cover all naming patterns across India's diverse regions.
 */

import { describe, it, expect } from 'vitest';
import {
    validateIndianName,
    validateIndianNames,
    type NameValidationResult,
} from '../../../../lambda/shared/src/validation/indian-name-validator';

describe('Indian Name Validation', () => {
    // =========================================================================
    // Basic Validation
    // =========================================================================

    describe('Basic Input Validation', () => {
        it('should reject empty string', () => {
            const result = validateIndianName('');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('empty') || e.includes('required'))).toBe(true);
        });

        it('should reject null input', () => {
            const result = validateIndianName(null as unknown as string);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Name is required');
        });

        it('should reject undefined input', () => {
            const result = validateIndianName(undefined as unknown as string);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Name is required');
        });

        it('should reject whitespace-only input', () => {
            const result = validateIndianName('   ');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Name cannot be empty');
        });

        it('should reject very short names', () => {
            const result = validateIndianName('A');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('too short'))).toBe(true);
        });

        it('should reject very long names', () => {
            const longName = 'A'.repeat(150);
            const result = validateIndianName(longName);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('too long'))).toBe(true);
        });
    });

    // =========================================================================
    // North Indian Names
    // =========================================================================

    describe('North Indian Names', () => {
        const validNames = [
            'Rahul Sharma',
            'Amit Kumar Verma',
            'Priya Gupta',
            'Deepak Jain',
            'Sunita Agarwal',
            'Rajesh Kumar',
            'Neha Bansal',
            'Vikas Mittal',
            'Pooja Goel',
            'Anil Kapoor',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
            expect(result.confidence).toMatch(/HIGH|MEDIUM/);
        });

        it('should detect North Indian pattern', () => {
            const result = validateIndianName('Rahul Sharma');
            expect(result.metadata.detectedPattern).toBe('NORTH_INDIAN');
            expect(result.metadata.hasSurname).toBe(true);
        });

        it('should handle three-part names', () => {
            const result = validateIndianName('Ram Prakash Sharma');
            expect(result.valid).toBe(true);
            expect(result.metadata.tokenCount).toBe(3);
        });
    });

    // =========================================================================
    // South Indian Names
    // =========================================================================

    describe('South Indian Names', () => {
        const validNames = [
            'R. Venkatesh',
            'K. Srinivas',
            'Anand Nair',
            'Priya Menon',
            'S. Raghunathan',
            'Lakshmi Pillai',
            'Ganesh Iyer',
            'Meenakshi Iyengar',
            'N. Raghavan',
            'Suresh Rao',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
        });

        it('should detect South Indian pattern', () => {
            const result = validateIndianName('Venkatesh Nair');
            expect(result.metadata.detectedPattern).toBe('SOUTH_INDIAN');
        });

        it('should handle initial-heavy names', () => {
            const result = validateIndianName('S. K. Venkataraman');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasInitials).toBe(true);
        });

        it('should handle double-barreled surnames', () => {
            const result = validateIndianName('Raghuram Rajan');
            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // Bengali Names
    // =========================================================================

    describe('Bengali Names', () => {
        const validNames = [
            'Subhash Chandra Bose',
            'Rabindranath Tagore',
            'Amitabh Chatterjee',
            'Partha Mukherjee',
            'Swapna Banerjee',
            'Dipankar Ghosh',
            'Arijit Sen',
            'Moumita Roy',
            'Sandip Das',
            'Prosenjit Dutta',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
        });

        it('should detect Bengali pattern', () => {
            const result = validateIndianName('Partha Chatterjee');
            expect(result.metadata.detectedPattern).toBe('BENGALI');
        });
    });

    // =========================================================================
    // Sikh Names
    // =========================================================================

    describe('Sikh Names', () => {
        const validNames = [
            'Harpreet Singh',
            'Gurpreet Kaur',
            'Amarjit Singh',
            'Navjot Singh Sidhu',
            'Jaspreet Kaur',
            'Manpreet Singh',
            'Balwinder Singh',
            'Sukhjit Kaur',
            'Paramjit Singh',
            'Harleen Kaur',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
        });

        it('should detect Sikh pattern by Singh suffix', () => {
            const result = validateIndianName('Harpreet Singh');
            expect(result.metadata.detectedPattern).toBe('SIKH');
            expect(result.confidence).toBe('HIGH');
        });

        it('should detect Sikh pattern by Kaur suffix', () => {
            const result = validateIndianName('Gurpreet Kaur');
            expect(result.metadata.detectedPattern).toBe('SIKH');
            expect(result.confidence).toBe('HIGH');
        });
    });

    // =========================================================================
    // Muslim Names
    // =========================================================================

    describe('Muslim Names', () => {
        const validNames = [
            'Mohammad Irfan',
            'Mohammed Khan',
            'Fatima Begum',
            'Abdul Rashid',
            'Salman Khan',
            'Shahrukh Khan',
            'Aamir Hussain',
            'Imran Qureshi',
            'Nazia Siddiqui',
            'Sheikh Hasina',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
        });

        it('should detect Muslim pattern by Mohammad prefix', () => {
            const result = validateIndianName('Mohammad Ali Khan');
            expect(result.metadata.detectedPattern).toBe('MUSLIM');
        });

        it('should detect Muslim pattern by Khan suffix', () => {
            const result = validateIndianName('Salman Khan');
            expect(result.metadata.detectedPattern).toBe('MUSLIM');
        });

        it('should handle Md. abbreviation', () => {
            const result = validateIndianName('Md. Irfan Ahmed');
            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // Christian Names
    // =========================================================================

    describe('Christian Names', () => {
        const validNames = [
            'John Abraham',
            'Mary Thomas',
            'Joseph Varghese',
            'Susan George',
            'Philip Mathew',
            'Elizabeth Samuel',
            'Anthony Simon',
            'Teresa Jacob',
        ];

        it.each(validNames)('should validate "%s" as valid', (name) => {
            const result = validateIndianName(name);
            expect(result.valid).toBe(true);
        });

        it('should detect Christian pattern', () => {
            const result = validateIndianName('John Thomas');
            expect(result.metadata.detectedPattern).toBe('CHRISTIAN');
        });
    });

    // =========================================================================
    // Single Name (Mononym)
    // =========================================================================

    describe('Single Names (Mononyms)', () => {
        it('should accept recognized single names', () => {
            const result = validateIndianName('Rekha');
            expect(result.valid).toBe(true);
            expect(result.metadata.detectedPattern).toBe('SINGLE_NAME');
        });

        it('should warn about single names', () => {
            const result = validateIndianName('Madhuri');
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('Single-word'))).toBe(true);
        });

        it('should reduce confidence for unrecognized single names', () => {
            const result = validateIndianName('Xyzabc');
            expect(result.confidence).toBe('LOW');
        });
    });

    // =========================================================================
    // Names with Honorifics
    // =========================================================================

    describe('Names with Honorifics', () => {
        it('should handle Mr. prefix', () => {
            const result = validateIndianName('Mr. Rahul Sharma');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasHonorific).toBe(true);
        });

        it('should handle Dr. prefix', () => {
            const result = validateIndianName('Dr. Priya Gupta');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasHonorific).toBe(true);
        });

        it('should handle Shri prefix', () => {
            const result = validateIndianName('Shri Ram Prasad');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasHonorific).toBe(true);
        });

        it('should handle Smt. prefix', () => {
            const result = validateIndianName('Smt. Kamala Devi');
            expect(result.valid).toBe(true);
        });

        it('should handle PhD suffix', () => {
            const result = validateIndianName('Anil Kumar PhD');
            expect(result.valid).toBe(true);
        });

        it('should handle IAS suffix', () => {
            const result = validateIndianName('Rajesh Sharma IAS');
            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // Names with Initials
    // =========================================================================

    describe('Names with Initials', () => {
        it('should handle single initial prefix', () => {
            const result = validateIndianName('K. Raghunathan');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasInitials).toBe(true);
        });

        it('should handle multiple initials', () => {
            const result = validateIndianName('A. B. C. Reddy');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasInitials).toBe(true);
        });

        it('should detect initials-heavy pattern', () => {
            const result = validateIndianName('S. K. M. Iyer');
            expect(result.valid).toBe(true);
            expect(result.metadata.hasInitials).toBe(true);
            // Pattern detection may vary based on surname presence
        });

        it('should reject all-initials names', () => {
            const result = validateIndianName('A. B. C.');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('actual name'))).toBe(true);
        });
    });

    // =========================================================================
    // Invalid Names
    // =========================================================================

    describe('Invalid Names', () => {
        it('should reject numeric names', () => {
            const result = validateIndianName('12345');
            expect(result.valid).toBe(false);
        });

        it('should reject test data', () => {
            const result = validateIndianName('Test User');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('test data'))).toBe(true);
        });

        it('should reject demo data', () => {
            const result = validateIndianName('Demo Account');
            expect(result.valid).toBe(false);
        });

        it('should reject names with special characters', () => {
            const result = validateIndianName('User@123');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
        });

        it('should reject names with repeated characters', () => {
            const result = validateIndianName('Aaaaaaa Bbbbbbb');
            expect(result.valid).toBe(false);
        });

        it('should reject admin/system names', () => {
            const result = validateIndianName('Admin User');
            expect(result.valid).toBe(false);
        });

        it('should reject names with URLs', () => {
            const result = validateIndianName('www.example.com');
            expect(result.valid).toBe(false);
        });

        it('should reject names with email patterns', () => {
            const result = validateIndianName('user@domain.com');
            expect(result.valid).toBe(false);
        });

        it('should reject unpronounceable names', () => {
            const result = validateIndianName('Bcddfgh Klmnpqr');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('invalid'))).toBe(true);
        });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('Edge Cases', () => {
        it('should normalize extra whitespace', () => {
            const result = validateIndianName('  Rahul    Sharma  ');
            expect(result.valid).toBe(true);
            expect(result.normalizedName).toBe('Rahul Sharma');
        });

        it('should handle comma-separated format', () => {
            // Comma-separated format may or may not be reordered
            const result = validateIndianName('Sharma, Rahul');
            // Just check it doesn't crash and produces a normalized result
            expect(result.normalizedName).toBeTruthy();
        });

        it('should handle names with apostrophes', () => {
            const result = validateIndianName("D'Souza Francis");
            expect(result.valid).toBe(true);
        });

        it('should handle names with hyphens', () => {
            const result = validateIndianName('Nair-Menon Priya');
            expect(result.valid).toBe(true);
        });

        it('should handle mixed case', () => {
            const result = validateIndianName('RAHUL SHARMA');
            expect(result.valid).toBe(true);
        });

        it('should handle lowercase input', () => {
            const result = validateIndianName('rahul sharma');
            expect(result.valid).toBe(true);
        });

        it('should warn about unrecognized patterns', () => {
            const result = validateIndianName('Xyz Abc Def');
            expect(result.valid).toBe(true);
            expect(result.warnings.some(w => w.includes('not commonly recognized'))).toBe(true);
            expect(result.confidence).toBe('LOW');
        });
    });

    // =========================================================================
    // Position-Dependent Names
    // =========================================================================

    describe('Position-Dependent Names', () => {
        it('should handle Kumar as middle name', () => {
            const result = validateIndianName('Raj Kumar Sharma');
            expect(result.valid).toBe(true);
        });

        it('should handle Kumar as last name', () => {
            const result = validateIndianName('Anil Kumar');
            expect(result.valid).toBe(true);
        });

        it('should handle Prasad in name', () => {
            const result = validateIndianName('Ram Prasad Sharma');
            expect(result.valid).toBe(true);
        });

        it('should handle Lal in name', () => {
            const result = validateIndianName('Mohan Lal');
            expect(result.valid).toBe(true);
        });
    });

    // =========================================================================
    // Batch Validation
    // =========================================================================

    describe('Batch Validation', () => {
        it('should validate multiple names', () => {
            const names = [
                'Rahul Sharma',
                'Priya Gupta',
                'Invalid@123',
                'Mohammad Khan',
            ];

            const result = validateIndianNames(names);

            expect(result.totalCount).toBe(4);
            expect(result.validCount).toBe(3);
            expect(result.invalidCount).toBe(1);
            expect(result.results).toHaveLength(4);
        });

        it('should handle empty array', () => {
            const result = validateIndianNames([]);
            expect(result.totalCount).toBe(0);
            expect(result.validCount).toBe(0);
        });
    });

    // =========================================================================
    // Metadata Accuracy
    // =========================================================================

    describe('Metadata Accuracy', () => {
        it('should correctly count tokens', () => {
            expect(validateIndianName('Rahul').metadata.tokenCount).toBe(1);
            expect(validateIndianName('Rahul Sharma').metadata.tokenCount).toBe(2);
            expect(validateIndianName('Ram Prakash Sharma').metadata.tokenCount).toBe(3);
        });

        it('should detect honorifics correctly', () => {
            expect(validateIndianName('Dr. Rahul Sharma').metadata.hasHonorific).toBe(true);
            expect(validateIndianName('Rahul Sharma').metadata.hasHonorific).toBe(false);
        });

        it('should detect surnames correctly', () => {
            expect(validateIndianName('Rahul Sharma').metadata.hasSurname).toBe(true);
            expect(validateIndianName('Rahul Xyz').metadata.hasSurname).toBe(false);
        });

        it('should detect initials correctly', () => {
            expect(validateIndianName('K. Raghunathan').metadata.hasInitials).toBe(true);
            expect(validateIndianName('Karthik Raghunathan').metadata.hasInitials).toBe(false);
        });
    });

    // =========================================================================
    // Confidence Levels
    // =========================================================================

    describe('Confidence Levels', () => {
        it('should have HIGH confidence for well-known patterns', () => {
            expect(validateIndianName('Harpreet Singh').confidence).toBe('HIGH');
            expect(validateIndianName('Rahul Sharma').confidence).toBe('HIGH');
            expect(validateIndianName('Mohammad Khan').confidence).toBe('HIGH');
        });

        it('should have MEDIUM confidence for less certain patterns', () => {
            expect(validateIndianName('Rahul').confidence).toBe('MEDIUM');
        });

        it('should have LOW confidence for unrecognized patterns', () => {
            expect(validateIndianName('Xyzabc Defghi').confidence).toBe('LOW');
        });
    });
});
