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

export * from "./constants/collection.constants";
export * from "./constants/event.constants";
// Constants
export * from "./constants/status.constants";
// Spintax
export * from "./spintax/resolver";
export * from "./spintax/variable-injector";
export * from "./types/campaign.types";
// Types
export * from "./types/lead.types";
export * from "./types/log.types";
export * from "./types/metrics.types";
export * from "./types/settings.types";
