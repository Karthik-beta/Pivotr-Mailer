/**
 * Delete Lead Function
 *
 * Deletes a lead from the leads collection.
 * Uses server-side API key for proper authorization.
 *
 * API:
 *   POST / - Delete a lead
 *   Body: { leadId: string }
 */

import { Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "./lib/shared/constants/collection.constants";

interface DeleteLeadRequest {
    leadId: string;
}

interface AppwriteContext {
    req: {
        body: string;
        headers: Record<string, string>;
        method: string;
    };
    res: {
        json: (data: unknown, statusCode?: number) => unknown;
    };
    log: (message: string) => void;
    error: (message: string) => void;
}

export default async function main(context: AppwriteContext): Promise<unknown> {
    const { req, res, log, error: logErr } = context;

    // Get endpoint - fix localhost for Docker internal networking
    let endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "";
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
        endpoint = endpoint.replace("localhost", "appwrite").replace("127.0.0.1", "appwrite");
    }

    // Initialize Appwrite client with API key
    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "")
        .setKey(process.env.APPWRITE_API_KEY || "")
        .setSelfSigned(true);

    const databases = new Databases(client);

    try {
        // Parse request body
        let request: DeleteLeadRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { leadId } = request;

        // Validate required fields
        if (!leadId) {
            return res.json({ success: false, message: "leadId is required" }, 400);
        }

        log(`Deleting lead: ${leadId}`);

        // Delete lead from collection
        await databases.deleteDocument(
            DATABASE_ID,
            CollectionId.LEADS,
            leadId
        );

        log(`Lead deleted: ${leadId}`);

        return res.json({
            success: true,
            deletedId: leadId,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Delete lead error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
