/**
 * Shared Lambda Utilities - Barrel Export
 * 
 * Re-exports all shared modules for easy importing.
 */

// Types
export * from './types/lead.types.js';

// Config
export * from './config/safety.config.js';
export * from './config/environment.config.js';

// Clients
export * from './clients/dynamodb.client.js';
export * from './clients/ses.client.js';

// Utils
export * from './utils/logger.js';
export * from './utils/spintax.js';
export * from './utils/name-parser.js';
export * from './utils/gaussian.js';

// Validation - explicit exports to avoid ValidationError conflict
export {
    validateStagedLead,
    validateStagedLeads,
    type StagedLead,
    type LeadValidationResult,
    type BatchLeadValidationResult,
    type ValidationWarning,
    // Rename interface to distinguish from error class
    type ValidationError as LeadValidationError,
} from './validation/staging-lead-validator.js';
export * from './validation/campaign.schema.js';

// Errors
export * from './errors/errors.js';
