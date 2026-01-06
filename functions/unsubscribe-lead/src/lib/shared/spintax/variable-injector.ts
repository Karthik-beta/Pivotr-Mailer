/**
 * Variable Injector & Spintax Resolver
 *
 * Handles template variable substitution (e.g. {{firstName}}) and Spintax rotation.
 * Also provides utilities for unsubscribe link generation and verification.
 */

import { createHmac } from 'crypto';
import { FunctionId } from '../constants/collection.constants';
import type { Lead } from '../types/lead.types';

/**
 * Resolve variables and spintax in a template string.
 */
export function resolveTemplateVariables(
    template: string,
    lead: Lead,
    unsubscribeUrl: string
): string {
    // 1. Resolve Spintax first (so vars inside spintax work? or vice versa?
    // Usually Spintax allows variations, which then get vars injected.
    // But simple Spintax {Hi|Hello} doesn't usually contain vars.
    // Let's do Spintax first.
    let content = resolveSpintax(template);

    // 2. Inject Variables
    content = content.replace(/{{(\w+)}}/g, (_match, variable) => {
        switch (variable) {
            case 'firstName':
                return lead.parsedFirstName || lead.firstName || '';
            case 'lastName':
                return lead.parsedLastName || lead.lastName || '';
            case 'fullName':
                return lead.fullName || '';
            case 'companyName':
                return lead.companyName || '';
            case 'email':
                return lead.email || '';
            case 'unsubscribeUrl':
                return unsubscribeUrl;
            default:
                // Leave unknown variables as is, or replace with empty?
                // Best practice is to leave them or replace with fallback.
                // For now, empty string to avoid broken look.
                return '';
        }
    });

    return content;
}

/**
 * Resolve Spintax: {variant1|variant2|variant3}
 * Supports nested spintax.
 */
export function resolveSpintax(text: string): string {
    const spintaxRegex = /\{([^{}]+)\}/;

    while (spintaxRegex.test(text)) {
        text = text.replace(spintaxRegex, (_match, content) => {
            const variants = content.split('|');
            const randomIndex = Math.floor(Math.random() * variants.length);
            return variants[randomIndex];
        });
    }

    return text;
}

/**
 * Generate HMAC-signed unsubscribe URL
 */
export function generateUnsubscribeLink(
    leadId: string,
    functionEndpoint: string,
    functionId: string,
    secret: string
): string {
    const token = createHmac('sha256', secret).update(leadId).digest('hex');

    // Construct URL for the unsubscribe function
    // Format: https://[ENDPOINT]/v1/functions/[FUNCTION_ID]/executions?leadId=[ID]&token=[HMAC]
    // But Appwrite Functions are usually POST or async.
    // However, for a user-clickable link, we need a GET endpoint or a proxy.
    // For this system, we assume the Function has a domain or we use the Appwrite generic endpoint with execution.
    // NOTE: Appwrite Client SDK cannot easily execute from a link click without auth.
    // Typically this points to a backend proxy or the Appwrite Function Domain (if configured).

    // Assuming we are using Appwrite Function Domain usage (v1.4+)
    // or a dedicated tracking domain.
    // For now, we'll generate a generic URL structure that the user can configure.
    // We'll use the FunctionId relative path assuming a gateway.

    // Since we don't know the exact domain, we'll return a path that the specific
    // transport (SES) or a proxy can handle.
    // BUT, the requirement says "Unsubscribe Function".
    // Let's assume the function is exposed via a domain.
    return `${functionEndpoint}/response?leadId=${leadId}&token=${token}&fid=${FunctionId.UNSUBSCRIBE_LEAD || functionId}`;
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(leadId: string, token: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(leadId).digest('hex');
    return token === expected;
}
