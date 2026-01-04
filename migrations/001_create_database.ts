/**
 * Migration 001: Create Database
 *
 * Creates the main pivotr_mailer database.
 */
import { type Client, Databases } from "node-appwrite";
import { DATABASE_ID } from "../shared/constants/collection.constants";

export async function createDatabase(client: Client): Promise<string> {
	const databases = new Databases(client);

	try {
		// Check if database already exists
		const existingDb = await databases.get(DATABASE_ID);
		console.log(`Database '${DATABASE_ID}' already exists.`);
		return existingDb.$id;
	} catch {
		// Database doesn't exist, create it
		const database = await databases.create(
			DATABASE_ID,
			"Pivotr Mailer",
			true // enabled
		);

		console.log(`Database '${DATABASE_ID}' created successfully.`);
		return database.$id;
	}
}

/**
 * Appwrite CLI Migration Commands (Manual)
 *
 * If running via Appwrite Console instead of code:
 *
 * 1. Navigate to Appwrite Console → Databases
 * 2. Click "Create Database"
 * 3. Database ID: pivotr_mailer
 * 4. Database Name: Pivotr Mailer
 * 5. Enable the database
 */
