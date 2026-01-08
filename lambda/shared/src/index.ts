/**
 * Shared Lambda Utilities - Barrel Export
 * 
 * Re-exports all shared modules for easy importing.
 */

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

// Errors
export * from './errors/errors.js';
