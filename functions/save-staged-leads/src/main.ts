/**
 * Save Staged Leads Function
 *
 * Persists parsed Excel/CSV lead data to the staged_leads collection.
 * The frontend parses and validates data, this function saves it for review.
 *
 * API:
 *   POST / - Save staged leads from parsed file
 *   Body: { batchId: string, leads: StagedLeadInput[] }
 */

import { Client, Databases, ID } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../../../shared/constants/collection.constants";
import type {
    StagedLeadCreateInput,
    SaveStagedLeadsResponse,
    ImportBatchSummary,
} from "../../../shared/types/staged-lead.types";

interface SaveStagedLeadsRequest {
    batchId: string;
    leads: StagedLeadCreateInput[];
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

    // Initialize Appwrite client
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || "")
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "")
        .setKey(process.env.APPWRITE_API_KEY || "");

    const databases = new Databases(client);

    try {
        // Parse request body
        let request: SaveStagedLeadsRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { batchId, leads } = request;

        if (!batchId) {
            return res.json({ success: false, message: "batchId is required" }, 400);
        }

        if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.json({ success: false, message: "No leads provided" }, 400);
        }

        log(`Saving ${leads.length} staged leads for batch ${batchId}...`);

        const now = new Date().toISOString();
        let validCount = 0;
        let invalidCount = 0;
        let warningCount = 0;

        // Save each lead to staged_leads collection
        for (const lead of leads) {
            await databases.createDocument(DATABASE_ID, CollectionId.STAGED_LEADS, ID.unique(), {
                batchId: lead.batchId,
                rowNumber: lead.rowNumber,
                fullName: lead.fullName,
                email: lead.email,
                companyName: lead.companyName,
                phoneNumber: lead.phoneNumber || null,
                leadType: lead.leadType || null,
                validationErrors: JSON.stringify(lead.validationErrors || []),
                isValid: lead.isValid,
                importedAt: now,
                importedBy: lead.importedBy || null,
                metadata: lead.metadata ? JSON.stringify(lead.metadata) : null,
            });

            if (lead.isValid) {
                const hasWarnings = lead.validationErrors?.some((e) => e.severity === "warning");
                if (hasWarnings) {
                    warningCount++;
                }
                validCount++;
            } else {
                invalidCount++;
            }
        }

        const summary: ImportBatchSummary = {
            batchId,
            total: leads.length,
            valid: validCount,
            invalid: invalidCount,
            warnings: warningCount,
            importedAt: now,
        };

        log(`Batch ${batchId}: ${validCount} valid, ${invalidCount} invalid, ${warningCount} with warnings`);

        const response: SaveStagedLeadsResponse = {
            success: true,
            batchId,
            summary,
        };

        return res.json(response);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Save staged leads error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
