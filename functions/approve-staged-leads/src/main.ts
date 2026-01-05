/**
 * Approve Staged Leads Function
 *
 * Moves approved staged leads from staged_leads to the main leads collection.
 * Deletes processed records from staging.
 *
 * API:
 *   POST / - Approve staged leads
 *   Body: { batchId: string, leadIds?: string[] }
 */

import { Client, Databases, ID, Query } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "../../../shared/constants/collection.constants";
import { LeadStatus } from "../../../shared/constants/status.constants";
import type { ApproveStagedLeadsResponse } from "../../../shared/types/staged-lead.types";

interface ApproveStagedLeadsRequest {
    batchId: string;
    /** If provided, approve only these IDs. Otherwise approve all valid in batch */
    leadIds?: string[];
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

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || "")
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || "")
        .setKey(process.env.APPWRITE_API_KEY || "");

    const databases = new Databases(client);

    try {
        let request: ApproveStagedLeadsRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { batchId, leadIds } = request;

        if (!batchId) {
            return res.json({ success: false, message: "batchId is required" }, 400);
        }

        log(`Approving staged leads for batch ${batchId}...`);

        // Build query for staged leads
        const queries = [Query.equal("batchId", batchId)];

        if (leadIds && leadIds.length > 0) {
            // Approve specific leads
            queries.push(Query.equal("$id", leadIds));
        } else {
            // Approve all valid leads in batch
            queries.push(Query.equal("isValid", true));
        }

        // Fetch staged leads to approve
        const stagedResult = await databases.listDocuments(
            DATABASE_ID,
            CollectionId.STAGED_LEADS,
            [...queries, Query.limit(1000)]
        );

        let importedCount = 0;
        let skippedCount = 0;

        for (const doc of stagedResult.documents) {
            try {
                // Skip invalid leads if approving all
                if (!doc.isValid && !leadIds) {
                    skippedCount++;
                    continue;
                }

                // Create lead in main collection
                await databases.createDocument(DATABASE_ID, CollectionId.LEADS, ID.unique(), {
                    fullName: doc.fullName,
                    email: doc.email,
                    companyName: doc.companyName,
                    phoneNumber: doc.phoneNumber || null,
                    leadType: doc.leadType || null,
                    status: LeadStatus.PENDING_IMPORT,
                    isUnsubscribed: false,
                    metadata: doc.metadata || null,
                });

                // Delete from staging
                await databases.deleteDocument(DATABASE_ID, CollectionId.STAGED_LEADS, doc.$id);

                importedCount++;
            } catch (err) {
                logErr(`Failed to import lead ${doc.$id}: ${err instanceof Error ? err.message : String(err)}`);
                skippedCount++;
            }
        }

        log(`Batch ${batchId}: Imported ${importedCount}, skipped ${skippedCount}`);

        const response: ApproveStagedLeadsResponse = {
            success: true,
            imported: importedCount,
            skipped: skippedCount,
            message: `Imported ${importedCount} leads, skipped ${skippedCount}`,
        };

        return res.json(response);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Approve staged leads error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
