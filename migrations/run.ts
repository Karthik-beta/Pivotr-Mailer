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

import { createInitialSchema } from "./001_initial_setup";

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
		await createInitialSchema(client);
		console.log("");
		console.log("═══════════════════════════════════════════════════════════════");
		console.log("✓ ALL MIGRATIONS COMPLETED SUCCESSFULLY");
		console.log("═══════════════════════════════════════════════════════════════");
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
