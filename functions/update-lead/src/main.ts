/**
 * Update Lead Function
 *
 * Updates a lead in the leads collection.
 * Uses server-side API key for proper authorization.
 *
 * API:
 *   POST / - Update an existing lead
 *   Body: { leadId: string, data: { parsedFirstName?, phoneNumber?, leadType?, status?, ... } }
 */

import { Client, Databases } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "./lib/shared/constants/collection.constants";

interface UpdateLeadRequest {
    leadId: string;
    data: {
        parsedFirstName?: string | null;
        phoneNumber?: string | null;
        leadType?: "HARDWARE" | "SOFTWARE" | "BOTH" | null;
        status?: string;
        verificationResult?: string | null;
        verificationTimestamp?: string | null;
        sesMessageId?: string | null;
        bounceType?: string | null;
        bounceSubType?: string | null;
        complaintFeedbackType?: string | null;
        campaignId?: string | null;
        queuePosition?: number | null;
        processingStartedAt?: string | null;
        processedAt?: string | null;
        errorMessage?: string | null;
        isUnsubscribed?: boolean;
        unsubscribedAt?: string | null;
        metadata?: Record<string, unknown> | null;
    };
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
        let request: UpdateLeadRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { leadId, data } = request;

        // Validate required fields
        if (!leadId) {
            return res.json({ success: false, message: "leadId is required" }, 400);
        }

        if (!data || Object.keys(data).length === 0) {
            return res.json({ success: false, message: "data object is required" }, 400);
        }

        log(`Updating lead: ${leadId}`);

        // Update lead in collection
        const document = await databases.updateDocument(
            DATABASE_ID,
            CollectionId.LEADS,
            leadId,
            data
        );

        log(`Lead updated: ${document.$id}`);

        return res.json({
            success: true,
            lead: {
                $id: document.$id,
                $updatedAt: document.$updatedAt,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Update lead error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
