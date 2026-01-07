/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         DATABASE MIGRATIONS                               ║
 * ║                                                                           ║
 * ║  These migration files define the Appwrite database schema.              ║
 * ║  They are designed to be run via Appwrite CLI or manually in Console.   ║
 * ║                                                                           ║
 * ║  Run order:                                                               ║
 * ║    1. 001_create_database.ts                                              ║
 * ║    2. 002_create_leads.ts                                                 ║
 * ║    3. 003_create_campaigns.ts                                             ║
 * ║    4. 004_create_logs.ts                                                  ║
 * ║    5. 005_create_metrics.ts                                               ║
 * ║    6. 006_create_settings.ts                                              ║
 * ║    7. 007_create_indexes.ts                                               ║
 * ║    8. 008_seed_initial_data.ts                                            ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export * from "./001_create_database";
export * from "./002_create_leads";
export * from "./003_create_campaigns";
export * from "./004_create_logs";
export * from "./005_create_metrics";
export * from "./006_create_settings";
export * from "./007_create_indexes";
export * from "./008_seed_initial_data";
export * from "./009_create_locks";
export * from "./010_create_staged_leads";
export * from "./011_add_phone_number_to_leads";
export * from "./012_add_lead_type_to_leads";
export * from "./013_add_email_events_metrics";
