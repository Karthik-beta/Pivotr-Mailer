/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         SHARED TYPES & CONSTANTS                          ║
 * ║                                                                           ║
 * ║  This barrel file exports all shared types, interfaces, and constants    ║
 * ║  used across frontend and backend (Appwrite Functions).                  ║
 * ║                                                                           ║
 * ║  ⚠️  DO NOT duplicate these types elsewhere. Import from here.           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

// Types
export * from './types/lead.types';
export * from './types/campaign.types';
export * from './types/log.types';
export * from './types/metrics.types';
export * from './types/settings.types';

// Constants
export * from './constants/status.constants';
export * from './constants/event.constants';
export * from './constants/collection.constants';
