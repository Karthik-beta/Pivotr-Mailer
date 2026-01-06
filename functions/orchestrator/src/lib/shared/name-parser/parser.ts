/**
 * Indian Name Parser
 *
 * Extracts the most natural "first name" for email personalization
 * from Indian full names, which have highly variable formats.
 *
 * This parser handles:
 * - Honorific prefixes (Mr., Dr., Shri, etc.)
 * - Professional suffixes (PhD, MBA, IAS, etc.)
 * - South Indian initial patterns (K. Ramachandran)
 * - Comma-separated formats (Sharma, Rajesh Kumar)
 * - Muslim name patterns (Mohammad Abdul Rahman)
 *
 * @example
 * parseIndianName("Mr. Rajesh Kumar Sharma") // "Rajesh"
 * parseIndianName("K. Ramachandran")         // "Ramachandran"
 * parseIndianName("Dr. Priya S. Venkatesh")  // "Priya"
 */

import { HONORIFIC_PREFIXES, HONORIFIC_SUFFIXES } from './honorifics';
import { COMMON_SURNAMES, POSITION_DEPENDENT_NAMES } from './surnames';

export interface ParsedName {
    /** The extracted first name for personalization */
    firstName: string;
    /** Original input name */
    originalName: string;
    /** Confidence level: HIGH, MEDIUM, LOW */
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    /** Parsing notes for debugging */
    notes: string[];
}

/**
 * Parse an Indian name and extract the first name for personalization.
 */
export function parseIndianName(fullName: string): ParsedName {
    const notes: string[] = [];
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';

    // Stage 1: Normalization
    let normalized = normalizeText(fullName);
    if (!normalized) {
        return {
            firstName: '',
            originalName: fullName,
            confidence: 'LOW',
            notes: ['Empty input after normalization'],
        };
    }
    notes.push(`Normalized: "${normalized}"`);

    // Stage 2: Remove honorific prefixes
    const afterPrefix = removeHonorificPrefixes(normalized);
    if (afterPrefix !== normalized) {
        notes.push(`Removed prefix, now: "${afterPrefix}"`);
        normalized = afterPrefix;
    }

    // Stage 2b: Remove honorific suffixes
    const afterSuffix = removeHonorificSuffixes(normalized);
    if (afterSuffix !== normalized) {
        notes.push(`Removed suffix, now: "${afterSuffix}"`);
        normalized = afterSuffix;
    }

    // Stage 3: Handle comma-separated format (Last, First Middle)
    if (normalized.includes(',')) {
        const reordered = reorderCommaSeparated(normalized);
        notes.push(`Reordered comma format: "${reordered}"`);
        normalized = reordered;
    }

    // Split into tokens
    const tokens = normalized.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return {
            firstName: '',
            originalName: fullName,
            confidence: 'LOW',
            notes: ['No tokens after processing'],
        };
    }

    if (tokens.length === 1) {
        // Single word name - return as-is
        return {
            firstName: toTitleCase(tokens[0]),
            originalName: fullName,
            confidence: 'MEDIUM',
            notes: [...notes, 'Single token name'],
        };
    }

    // Stage 4: Handle initials (skip them to find full first name)
    let firstNameIndex = 0;
    while (firstNameIndex < tokens.length && isInitial(tokens[firstNameIndex])) {
        notes.push(`Skipping initial: "${tokens[firstNameIndex]}"`);
        firstNameIndex++;
    }

    if (firstNameIndex >= tokens.length) {
        // All tokens are initials
        return {
            firstName: '',
            originalName: fullName,
            confidence: 'LOW',
            notes: [...notes, 'All tokens are initials'],
        };
    }

    let candidateFirstName = tokens[firstNameIndex];
    notes.push(`Candidate first name: "${candidateFirstName}"`);

    // Stage 5: Common surname detection
    const candidateLower = candidateFirstName.toLowerCase();

    // Check position-dependent names (like "Kumar")
    // These are surnames ONLY if they appear at the end
    if (POSITION_DEPENDENT_NAMES.has(candidateLower)) {
        const isLastToken = firstNameIndex === tokens.length - 1;
        if (!isLastToken) {
            // Kumar at start/middle is likely a first name (e.g., "Kumar Sanu")
            notes.push(
                `"${candidateFirstName}" is position-dependent but not last - treating as first name`
            );
        } else {
            // Kumar at end - try to find another candidate
            if (firstNameIndex > 0 || tokens.length > 1) {
                // Look for non-initial, non-surname token
                for (let i = 0; i < tokens.length - 1; i++) {
                    if (!isInitial(tokens[i]) && !COMMON_SURNAMES.has(tokens[i].toLowerCase())) {
                        candidateFirstName = tokens[i];
                        notes.push(`Position-dependent surname at end, using: "${candidateFirstName}"`);
                        confidence = 'MEDIUM';
                        break;
                    }
                }
            }
        }
    }
    // Check if candidate is a common surname
    else if (COMMON_SURNAMES.has(candidateLower)) {
        notes.push(`"${candidateFirstName}" is a common surname`);
        // Try the next token
        if (firstNameIndex + 1 < tokens.length && !isInitial(tokens[firstNameIndex + 1])) {
            candidateFirstName = tokens[firstNameIndex + 1];
            notes.push(`Using next token: "${candidateFirstName}"`);
            confidence = 'MEDIUM';
        }
    }

    // Stage 6: Muslim name pattern handling
    const muslimPrefixes = ['mohammad', 'mohammed', 'muhammed', 'md', 'sheikh', 'shaikh'];
    if (muslimPrefixes.includes(candidateLower)) {
        // For "Mohammad Abdul Rahman", consider "Abdul" or the next token
        if (firstNameIndex + 1 < tokens.length) {
            candidateFirstName = tokens[firstNameIndex + 1];
            notes.push(`Muslim name pattern, using: "${candidateFirstName}"`);
            confidence = 'MEDIUM';
        }
    }

    // Stage 7: Final extraction
    const firstName = toTitleCase(candidateFirstName);

    return {
        firstName,
        originalName: fullName,
        confidence,
        notes,
    };
}

/**
 * Stage 1: Normalize text
 */
function normalizeText(text: string): string {
    if (!text) return '';

    return (
        text
            // Normalize to NFC form
            .normalize('NFC')
            // Remove invisible characters
            .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
            // Remove control characters except newline
            .replace(/[\u0000-\u0009\u000B-\u001F]/g, '')
            // Collapse multiple spaces
            .replace(/\s+/g, ' ')
            // Trim whitespace
            .trim()
    );
}

/**
 * Stage 2a: Remove honorific prefixes
 */
function removeHonorificPrefixes(text: string): string {
    const words = text.split(/\s+/);

    while (words.length > 0) {
        const firstWord = words[0].toLowerCase().replace(/\./g, '');
        if (HONORIFIC_PREFIXES.has(firstWord)) {
            words.shift();
        } else {
            break;
        }
    }

    return words.join(' ');
}

/**
 * Stage 2b: Remove honorific suffixes
 */
function removeHonorificSuffixes(text: string): string {
    const words = text.split(/\s+/);

    while (words.length > 0) {
        const lastWord = words[words.length - 1].toLowerCase().replace(/\./g, '');
        if (HONORIFIC_SUFFIXES.has(lastWord)) {
            words.pop();
        } else {
            break;
        }
    }

    return words.join(' ');
}

/**
 * Stage 3: Reorder comma-separated format
 */
function reorderCommaSeparated(text: string): string {
    const parts = text.split(',').map((s) => s.trim());
    if (parts.length === 2) {
        // "Sharma, Rajesh Kumar" → "Rajesh Kumar Sharma"
        return `${parts[1]} ${parts[0]}`;
    }
    return text;
}

/**
 * Check if a token is an initial (single letter with optional period)
 */
function isInitial(token: string): boolean {
    // Match single letter, optionally followed by period
    return /^[A-Za-z]\.?$/.test(token);
}

/**
 * Convert string to Title Case
 */
function toTitleCase(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
