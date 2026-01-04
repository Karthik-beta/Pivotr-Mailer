import { Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../shared/constants/collection.constants";

async function debugAttributes() {
	const endpoint = process.env.APPWRITE_ENDPOINT;
	const projectId = process.env.APPWRITE_PROJECT_ID;
	const apiKey = process.env.APPWRITE_API_KEY;

	if (!endpoint || !projectId || !apiKey) {
		console.error("Missing env vars");
		return;
	}

	const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
	const databases = new Databases(client);

	try {
		console.log("--- Settings Attributes ---");
		const settingsAttrs = await databases.listAttributes(DATABASE_ID, CollectionId.SETTINGS);
		settingsAttrs.attributes.forEach((attr: unknown) => {
			const _attr = attr as { key: string; type: string; required: boolean };
			console.log(`- ${_attr.key} (${_attr.type}) Required: ${_attr.required}`);
		});

		console.log("\n--- Logs Attributes ---");
		const logsAttrs = await databases.listAttributes(DATABASE_ID, CollectionId.LOGS);
		logsAttrs.attributes.forEach((attr: unknown) => {
			const _attr = attr as { key: string; type: string; required: boolean };
			console.log(`- ${_attr.key} (${_attr.type}) Required: ${_attr.required}`);
		});
	} catch (error) {
		console.error("Error:", error);
	}
}

debugAttributes();
