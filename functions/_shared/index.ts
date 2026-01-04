/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    SHARED FUNCTION UTILITIES                              ║
 * ║                                                                           ║
 * ║  Common utilities shared across all Appwrite Functions.                  ║
 * ║  Import from this barrel file in function entry points.                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// Name Parser
export * from './name-parser/parser';
export * from './name-parser/honorifics';
export * from './name-parser/surnames';

// Spintax
export * from './spintax/resolver';
export * from './spintax/variable-injector';

// External API Clients
export * from './email-verifier/client';
export * from './ses-client/client';
export * from './sqs-client/client';

// Database Repositories
export * from './database/repositories/lead.repository';
export * from './database/repositories/campaign.repository';
export * from './database/repositories/log.repository';
export * from './database/repositories/metrics.repository';
export * from './database/repositories/settings.repository';

// Error Handling
export * from './errors/base-error';
export * from './errors/error-handler';

// Locking
export * from './locking/campaign-lock';
