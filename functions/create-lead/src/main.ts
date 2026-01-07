/**
 * Create Lead Function
 *
 * Creates a single lead in the leads collection.
 * Uses server-side API key for proper authorization.
 *
 * API:
 *   POST / - Create a new lead
 *   Body: { fullName: string, email: string, companyName: string, phoneNumber?: string, leadType?: string }
 */

import { Client, Databases, ID, Permission, Role } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "./lib/shared/constants/collection.constants";
import { LeadStatus } from "./lib/shared/constants/status.constants";

interface CreateLeadRequest {
    fullName: string;
    email: string;
    companyName: string;
    phoneNumber?: string | null;
    leadType?: "HARDWARE" | "SOFTWARE" | "BOTH" | null;
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
        let request: CreateLeadRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { fullName, email, companyName, phoneNumber, leadType } = request;

        // Validate required fields
        if (!fullName || !fullName.trim()) {
            return res.json({ success: false, message: "fullName is required" }, 400);
        }

        if (!email || !email.trim()) {
            return res.json({ success: false, message: "email is required" }, 400);
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.json({ success: false, message: "Invalid email format" }, 400);
        }

        if (!companyName || !companyName.trim()) {
            return res.json({ success: false, message: "companyName is required" }, 400);
        }

        log(`Creating lead: ${email}`);

        // Create lead in main collection
        const document = await databases.createDocument(
            DATABASE_ID,
            CollectionId.LEADS,
            ID.unique(),
            {
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                companyName: companyName.trim(),
                phoneNumber: phoneNumber?.trim() || null,
                leadType: leadType || null,
                status: LeadStatus.PENDING_IMPORT,
                parsedFirstName: null,
                verificationResult: null,
                verificationTimestamp: null,
                sesMessageId: null,
                bounceType: null,
                bounceSubType: null,
                complaintFeedbackType: null,
                campaignId: null,
                queuePosition: null,
                processingStartedAt: null,
                processedAt: null,
                errorMessage: null,
                isUnsubscribed: false,
                unsubscribedAt: null,
                metadata: null,
            },
            [
                Permission.read(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        );

        log(`Lead created: ${document.$id}`);

        return res.json({
            success: true,
            lead: {
                $id: document.$id,
                fullName: document.fullName,
                email: document.email,
                companyName: document.companyName,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Create lead error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
