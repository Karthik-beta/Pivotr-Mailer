
import { Client, Functions } from 'node-appwrite';
import appwriteConfig from '../appwrite.config.json';

// Detect Environment Variables (supporting prefixes)
const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.VITE_APPWRITE_API_KEY;

console.log("Environment Config:");
console.log("- Endpoint:", ENDPOINT);
console.log("- Project ID:", PROJECT_ID);
console.log("- API Key Exists:", !!API_KEY);

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
    console.error("\nError: Missing required environment variables.");
    console.error("Checked for: APPWRITE_ENDPOINT/VITE_APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID..., APPWRITE_API_KEY...");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY)
    .setSelfSigned(true);

const functions = new Functions(client);

// Sync API Key to all functions
async function main() {
    const functionIds = appwriteConfig.functions.map(f => f.$id);
    console.log(`\nSyncing APPWRITE_API_KEY to ${functionIds.length} functions...`);

    for (const funcId of functionIds) {
        process.stdout.write(`Function ${funcId}: `);
        try {
            // Check existing variables
            const varList = await functions.listVariables(funcId);
            const varKey = 'APPWRITE_API_KEY';
            const existingVar = varList.variables.find(v => v.key === varKey);

            if (existingVar) {
                // Update
                await functions.updateVariable(funcId, existingVar.$id, varKey, API_KEY!);
                console.log("Updated.");
            } else {
                // Create
                await functions.createVariable(funcId, varKey, API_KEY!);
                console.log("Created.");
            }
        } catch (err: any) {
            console.log(`Failed - ${err.message}`);
        }
    }
    console.log("\nSync Complete.");
}

main();
