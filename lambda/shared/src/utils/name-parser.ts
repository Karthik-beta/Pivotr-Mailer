/**
 * Indian Name Parser
 *
 * Extracts the most natural "first name" for email personalization
 * from Indian full names, which have highly variable formats.
 */

import { HONORIFIC_PREFIXES, HONORIFIC_SUFFIXES, COMMON_SURNAMES, POSITION_DEPENDENT_NAMES } from './name-parser-data.js';

export interface ParsedName {
    firstName: string;
    originalName: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
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
        return { firstName: '', originalName: fullName, confidence: 'LOW', notes: ['Empty input'] };
    }

    // Stage 2: Remove honorific prefixes
    const afterPrefix = removeHonorificPrefixes(normalized);
    if (afterPrefix !== normalized) normalized = afterPrefix;

    // Stage 2b: Remove honorific suffixes
    const afterSuffix = removeHonorificSuffixes(normalized);
    if (afterSuffix !== normalized) normalized = afterSuffix;

    // Stage 3: Handle comma-separated format
    if (normalized.includes(',')) {
        normalized = reorderCommaSeparated(normalized);
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        return { firstName: '', originalName: fullName, confidence: 'LOW', notes: ['No tokens'] };
    }
    if (tokens.length === 1) {
        return { firstName: toTitleCase(tokens[0]), originalName: fullName, confidence: 'MEDIUM', notes: ['Single token'] };
    }

    // Stage 4: Skip initials
    let firstNameIndex = 0;
    while (firstNameIndex < tokens.length && isInitial(tokens[firstNameIndex])) {
        firstNameIndex++;
    }

    if (firstNameIndex >= tokens.length) {
        // Fallback: If all initials, try to use the last one logic or return empty
        return { firstName: '', originalName: fullName, confidence: 'LOW', notes: ['All initials'] };
    }

    let candidateFirstName = tokens[firstNameIndex];
    const candidateLower = candidateFirstName.toLowerCase();

    // Stage 5: Common surname detection
    if (POSITION_DEPENDENT_NAMES.has(candidateLower)) {
        const isLastToken = firstNameIndex === tokens.length - 1;
        if (isLastToken) {
            // Kumar at end - search backward or forward?
            // Try finding another candidate
            if (firstNameIndex > 0 || tokens.length > 1) {
                for (let i = 0; i < tokens.length - 1; i++) {
                    if (!isInitial(tokens[i]) && !COMMON_SURNAMES.has(tokens[i].toLowerCase())) {
                        candidateFirstName = tokens[i];
                        confidence = 'MEDIUM';
                        break;
                    }
                }
            }
        }
    } else if (COMMON_SURNAMES.has(candidateLower)) {
        if (firstNameIndex + 1 < tokens.length && !isInitial(tokens[firstNameIndex + 1])) {
            candidateFirstName = tokens[firstNameIndex + 1];
            confidence = 'MEDIUM';
        }
    }

    // Stage 6: Muslim name patterns
    const muslimPrefixes = ['mohammad', 'mohammed', 'muhammed', 'md', 'sheikh', 'shaikh'];
    if (muslimPrefixes.includes(candidateLower) && firstNameIndex + 1 < tokens.length) {
        candidateFirstName = tokens[firstNameIndex + 1];
        confidence = 'MEDIUM';
    }

    return {
        firstName: toTitleCase(candidateFirstName),
        originalName: fullName,
        confidence,
        notes,
    };
}

function normalizeText(text: string): string {
    if (!text) return '';
    return text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

function removeHonorificPrefixes(text: string): string {
    const words = text.split(/\s+/);
    while (words.length > 0) {
        const firstWord = words[0].toLowerCase().replace(/\./g, '');
        if (HONORIFIC_PREFIXES.has(firstWord)) words.shift();
        else break;
    }
    return words.join(' ');
}

function removeHonorificSuffixes(text: string): string {
    const words = text.split(/\s+/);
    while (words.length > 0) {
        const lastWord = words[words.length - 1].toLowerCase().replace(/\./g, '');
        if (HONORIFIC_SUFFIXES.has(lastWord)) words.pop();
        else break;
    }
    return words.join(' ');
}

function reorderCommaSeparated(text: string): string {
    const parts = text.split(',').map(s => s.trim());
    return parts.length === 2 ? `${parts[1]} ${parts[0]}` : text;
}

function isInitial(token: string): boolean {
    return /^[A-Za-z]\.?$/.test(token);
}

function toTitleCase(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '';
}
