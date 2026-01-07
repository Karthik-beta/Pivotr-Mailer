import { Client, Databases, Permission, Role, Query } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

// Load envs from .env file manually if needed, or rely on bun's auto loading
// Assuming this is run from project root with `bun run scripts/fix-lead-permissions.ts`

async function fixPermissions() {
    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
        console.error("Missing env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY");
        process.exit(1);
    }

    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new Databases(client);

    console.log("Fetching leads...");
    let leads: any[] = [];
    let offset = 0;
    const limit = 100;

    // Fetch all leads
    while (true) {
        const response = await databases.listDocuments(
            DATABASE_ID,
            CollectionId.LEADS,
            [Query.limit(limit), Query.offset(offset)]
        );
        leads.push(...response.documents);
        if (response.documents.length < limit) break;
        offset += limit;
    }

    console.log(`Found ${leads.length} leads. Checking permissions...`);

    let updated = 0;

    for (const lead of leads) {
        // Check if permissions need update
        // We want to ensure Permission.read(Role.users()) exists
        // $permissions is array of strings like 'read("users")', 'update("users")'

        // Note: SDK returns permissions in $permissions property? 
        // Actually listDocuments with server key returns everything, showing $permissions.

        const permissions = lead.$permissions || [];
        const hasUserRead = permissions.includes('read("users")') || permissions.includes('read("role:users")');

        if (!hasUserRead) {
            console.log(`Fixing permissions for lead ${lead.$id} (${lead.email})...`);

            // Overwrite permissions
            await databases.updateDocument(
                DATABASE_ID,
                CollectionId.LEADS,
                lead.$id,
                {}, // No data update
                [
                    Permission.read(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users())
                ]
            );
            updated++;
        }
    }

    console.log(`Fixed ${updated} leads.`);
}

fixPermissions().catch(console.error);
