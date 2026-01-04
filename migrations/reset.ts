/**
 * Reset Migration
 *
 * Deletes the database to allow fresh migration runs.
 * WARNING: This will delete ALL data!
 *
 * Usage:
 *   bun run migrations/reset.ts
 */
import { Client, Databases } from "node-appwrite";
import { DATABASE_ID } from "../shared/constants/collection.constants";

async function resetDatabase(): Promise<void> {
	console.log("╔═══════════════════════════════════════════════════════════════╗");
	console.log("║           PIVOTR MAILER - DATABASE RESET                      ║");
	console.log("╚═══════════════════════════════════════════════════════════════╝");
	console.log("");
	console.log("⚠️  WARNING: This will DELETE the entire database and all data!");
	console.log("");

	// Validate environment variables
	const endpoint = process.env.APPWRITE_ENDPOINT;
	const projectId = process.env.APPWRITE_PROJECT_ID;
	const apiKey = process.env.APPWRITE_API_KEY;

	if (!endpoint || !projectId || !apiKey) {
		console.error("ERROR: Missing required environment variables.");
		process.exit(1);
	}

	// Initialize Appwrite client
	const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
	const databases = new Databases(client);

	console.log(`Connecting to: ${endpoint}`);
	console.log(`Project: ${projectId}`);
	console.log(`Database ID: ${DATABASE_ID}`);
	console.log("");

	try {
		console.log("Deleting database...");
		await databases.delete(DATABASE_ID);
		console.log("✓ Database deleted successfully.");
		console.log("");
		console.log("You can now run: bun run migrations/run.ts");
	} catch (error: unknown) {
		if (error instanceof Error && "code" in error && (error as { code: number }).code === 404) {
			console.log("Database does not exist. Nothing to delete.");
		} else {
			console.error("Error deleting database:", error);
			process.exit(1);
		}
	}
}

resetDatabase();
