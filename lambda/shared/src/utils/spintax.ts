/**
 * Spintax & Variable Injection Utility
 *
 * Handles Spintax resolution ({Hi|Hello}) and variable injection ({{FirstName}}).
 * Essential for generating unique, personalized email content.
 */

import { randomBytes } from 'crypto';

/**
 * Maximum iterations to prevent infinite loops from malformed Spintax.
 */
const MAX_ITERATIONS = 10;

/**
 * Regex to match Spintax groups (innermost first).
 */
const SPINTAX_REGEX = /\{([^{}]*)\}/g;

/**
 * Resolve all Spintax in a template string.
 * Uses cryptographically secure random selection.
 * 
 * @example
 * resolveSpintax("{Hi|Hello} {{FirstName}}!")
 * // Returns one of: "Hi {{FirstName}}!", "Hello {{FirstName}}!"
 */
export function resolveSpintax(template: string): string {
    if (!template) return '';

    let resolved = template;
    let iterations = 0;

    // Keep resolving until no more Spintax found (handles nested)
    while (SPINTAX_REGEX.test(resolved) && iterations < MAX_ITERATIONS) {
        // Reset regex lastIndex
        SPINTAX_REGEX.lastIndex = 0;

        resolved = resolved.replace(SPINTAX_REGEX, (_match, content: string) => {
            const options = splitSpintaxOptions(content);
            if (options.length === 0) return '';
            if (options.length === 1) return options[0];

            const randomIndex = secureRandomInt(0, options.length - 1);
            return options[randomIndex];
        });

        iterations++;
    }

    // Unescape escaped pipes
    resolved = resolved.replace(/\\\|/g, '|');

    return resolved;
}

/**
 * Split Spintax content by pipe, respecting nesting and escapes.
 */
function splitSpintaxOptions(content: string): string[] {
    const options: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const prevChar = i > 0 ? content[i - 1] : '';

        if (char === '{') {
            depth++;
            current += char;
        } else if (char === '}') {
            depth--;
            current += char;
        } else if (char === '|' && depth === 0 && prevChar !== '\\') {
            // Unescaped pipe at top level - split here
            options.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    // Don't forget the last option
    options.push(current);

    return options;
}

/**
 * Generate a cryptographically secure random integer in range [min, max] (inclusive).
 */
function secureRandomInt(min: number, max: number): number {
    if (min > max) throw new Error('min must be less than or equal to max');
    if (min === max) return min;

    const range = max - min + 1;
    const maxBytes = 4; // 32-bit integer
    const maxVal = Math.pow(2, maxBytes * 8); // 4294967296

    // Calculate a rejection threshold to avoid modulo bias
    // We want to generate numbers up to the largest multiple of 'range' that fits in maxVal
    const threshold = maxVal - (maxVal % range);

    let randomValue: number;
    do {
        const buffer = randomBytes(maxBytes);
        randomValue = buffer.readUInt32BE(0);
    } while (randomValue >= threshold);

    return min + (randomValue % range);
}

/**
 * Variable map with case-insensitive keys.
 */
type VariableMap = Record<string, string>;

/**
 * Inject template variables into a resolved template.
 * 
 * @example
 * injectVariables("Hello {{FirstName}}", { firstName: "Rajesh" })
 * // Returns: "Hello Rajesh"
 */
export function injectVariables(template: string, variables: VariableMap): string {
    if (!template) return '';

    // Create case-insensitive lookup
    const normalizedVars: VariableMap = {};
    for (const [key, value] of Object.entries(variables)) {
        normalizedVars[key.toLowerCase()] = value;
    }

    // Replace all {{Variable}} patterns
    return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
        const value = normalizedVars[varName.toLowerCase()];
        // If variable not found, leave as is (don't break template)
        return value !== undefined ? value : `{{${varName}}}`;
    });
}

/**
 * Validate Spintax syntax in a template.
 * Returns an array of error messages, empty if valid.
 */
export function validateSpintax(template: string): string[] {
    const errors: string[] = [];
    let braceDepth = 0;
    let position = 0;

    for (const char of template) {
        position++;
        if (char === '{') {
            braceDepth++;
        } else if (char === '}') {
            braceDepth--;
            if (braceDepth < 0) {
                errors.push(`Unexpected closing brace at position ${position}`);
                braceDepth = 0;
            }
        }
    }

    if (braceDepth > 0) {
        errors.push(`Unclosed Spintax brace (${braceDepth} unclosed)`);
    }

    return errors;
}
