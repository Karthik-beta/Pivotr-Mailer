/**
 * Template Variable Injector
 *
 * Injects dynamic variables into email templates after Spintax resolution.
 *
 * Variables use double curly braces: {{VariableName}}
 * This is distinct from Spintax which uses single braces: {option1|option2}
 *
 * @example
 * injectVariables("Hello {{FirstName}} from {{Company}}!", {
 *   firstName: "Rajesh",
 *   company: "Pivotr"
 * })
 * // Returns: "Hello Rajesh from Pivotr!"
 */

import { createHmac } from 'crypto';
import type { Lead } from '../types/lead.types';

/**
 * Standard template variables available for injection
 */
export interface TemplateVariables {
    firstName: string;
    fullName: string;
    company: string;
    email: string;
    unsubscribeLink: string;
    /** Index signature for extensibility and log.types.ts compatibility */
    [key: string]: string;
}

/**
 * Variable map with case-insensitive keys
 */
type VariableMap = Record<string, string>;

/**
 * Reserved variable names that MUST be present in templates
 */
export const REQUIRED_VARIABLES = ['UnsubscribeLink'];

/**
 * All available variable names
 */
export const AVAILABLE_VARIABLES = ['FirstName', 'FullName', 'Company', 'Email', 'UnsubscribeLink'];

/**
 * Inject template variables into a resolved template.
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
        return value !== undefined ? value : `{{${varName}}}`; // Keep original if not found
    });
}

/**
 * Build template variables from a Lead document.
 */
export function buildTemplateVariables(lead: Lead, unsubscribeLink: string): TemplateVariables {
    return {
        firstName: lead.parsedFirstName || extractFirstWord(lead.fullName),
        fullName: lead.fullName,
        company: lead.companyName,
        email: lead.email,
        unsubscribeLink,
    };
}

/**
 * Convert TemplateVariables to a VariableMap for injection.
 */
export function templateVariablesToMap(vars: TemplateVariables): VariableMap {
    return {
        firstname: vars.firstName,
        fullname: vars.fullName,
        company: vars.company,
        email: vars.email,
        unsubscribelink: vars.unsubscribeLink,
    };
}

/**
 * Extract first word from a string as fallback for firstName.
 */
function extractFirstWord(text: string): string {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    return words[0] || '';
}

/**
 * Validate that all required variables are present in a template.
 * Returns an array of missing variable names.
 */
export function validateRequiredVariables(template: string): string[] {
    const missing: string[] = [];

    for (const varName of REQUIRED_VARIABLES) {
        const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'i');
        if (!regex.test(template)) {
            missing.push(varName);
        }
    }

    return missing;
}

/**
 * Extract all variable names used in a template.
 */
export function extractVariables(template: string): string[] {
    const variables: Set<string> = new Set();
    const regex = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
        variables.add(match[1]);
    }

    return Array.from(variables);
}

/**
 * Generate an unsubscribe link with HMAC token.
 */
export function generateUnsubscribeLink(
    baseUrl: string,
    functionId: string,
    leadId: string,
    secret: string
): string {
    const token = generateHmacToken(leadId, secret);
    return `${baseUrl}/v1/functions/${functionId}/executions?leadId=${encodeURIComponent(leadId)}&token=${encodeURIComponent(token)}`;
}

/**
 * Generate HMAC-SHA256 token for unsubscribe link.
 */
function generateHmacToken(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify an unsubscribe token.
 */
export function verifyUnsubscribeToken(leadId: string, token: string, secret: string): boolean {
    const expectedToken = generateHmacToken(leadId, secret);
    return token === expectedToken;
}
