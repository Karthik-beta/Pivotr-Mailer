/**
 * Migration Runner
 *
 * Executes all migrations in sequence to set up the Appwrite database.
 *
 * Usage:
 *   bun run migrations/run.ts
 *
 * Environment Variables Required:
 *   APPWRITE_ENDPOINT - Appwrite API endpoint (e.g., http://localhost:5000/v1)
 *   APPWRITE_PROJECT_ID - Your project ID
 *   APPWRITE_API_KEY - Server API key with database permissions
 */
import { Client } from "node-appwrite";

import { createDatabase } from "./001_create_database";
import { createLeadsCollection } from "./002_create_leads";
import { createCampaignsCollection } from "./003_create_campaigns";
import { createLogsCollection } from "./004_create_logs";
import { createMetricsCollection } from "./005_create_metrics";
import { createSettingsCollection } from "./006_create_settings";
import { createIndexes } from "./007_create_indexes";
import { seedInitialData } from "./008_seed_initial_data";

async function runMigrations(): Promise<void> {
	console.log("╔═══════════════════════════════════════════════════════════════╗");
	console.log("║           PIVOTR MAILER - DATABASE MIGRATIONS                 ║");
	console.log("╚═══════════════════════════════════════════════════════════════╝");
	console.log("");

	// Validate environment variables
	const endpoint = process.env.APPWRITE_ENDPOINT;
	const projectId = process.env.APPWRITE_PROJECT_ID;
	const apiKey = process.env.APPWRITE_API_KEY;

	if (!endpoint || !projectId || !apiKey) {
		console.error("ERROR: Missing required environment variables.");
		console.error("Required:");
		console.error("  APPWRITE_ENDPOINT  - e.g., http://localhost:5000/v1");
		console.error("  APPWRITE_PROJECT_ID - Your project ID");
		console.error("  APPWRITE_API_KEY   - Server API key");
		process.exit(1);
	}

	// Initialize Appwrite client
	const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

	console.log(`Connecting to: ${endpoint}`);
	console.log(`Project: ${projectId}`);
	console.log("");

	try {
		// Run migrations in sequence
		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 1/8: Creating database...");
		await createDatabase(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 2/8: Creating leads collection...");
		await createLeadsCollection(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 3/8: Creating campaigns collection...");
		await createCampaignsCollection(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 4/8: Creating logs collection...");
		await createLogsCollection(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 5/8: Creating metrics collection...");
		await createMetricsCollection(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 6/8: Creating settings collection...");
		await createSettingsCollection(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 7/8: Creating indexes...");
		await createIndexes(client);

		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step 8/8: Seeding initial data...");
		await seedInitialData(client);

		console.log("");
		console.log("═══════════════════════════════════════════════════════════════");
		console.log("✓ ALL MIGRATIONS COMPLETED SUCCESSFULLY");
		console.log("═══════════════════════════════════════════════════════════════");
		console.log("");
		console.log("Next steps:");
		console.log("  1. Verify collections in Appwrite Console");
		console.log("  2. Update settings document with AWS/MEV credentials");
		console.log("  3. Deploy Appwrite Functions");
		console.log("");
	} catch (error) {
		console.error("");
		console.error("═══════════════════════════════════════════════════════════════");
		console.error("✗ MIGRATION FAILED");
		console.error("═══════════════════════════════════════════════════════════════");
		console.error("");
		console.error("Error:", error);
		process.exit(1);
	}
}

// Run if executed directly
runMigrations();
