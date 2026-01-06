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

import { Client, Databases, ID, Permission, Query, Role } from "node-appwrite";
import { CollectionId, DATABASE_ID } from "./lib/shared/constants/collection.constants";
import { LeadStatus } from "./lib/shared/constants/status.constants";
import type { ApproveStagedLeadsResponse } from "./lib/shared/types/staged-lead.types";

interface ApproveStagedLeadsRequest {
    batchId: string;
    /** If provided, approve only these IDs. Otherwise approve all valid in batch */
    leadIds?: string[];
    /** Action to perform. Default is 'approve' */
    action?: "approve" | "discard";
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

    let endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || "";
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || "";

    // Fix for Appwrite Docker: use internal service name
    if (endpoint.includes("localhost") || endpoint.includes("127.0.0.1")) {
        endpoint = endpoint.replace("localhost", "appwrite").replace("127.0.0.1", "appwrite");
    }

    const client = new Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(process.env.APPWRITE_API_KEY || "")
        .setSelfSigned(true);

    const databases = new Databases(client);

    log(`[Debug] Init: Project=${projectId}, Endpoint=${endpoint}, KeyLen=${(process.env.APPWRITE_API_KEY || "").length}`);

    try {
        let request: ApproveStagedLeadsRequest;
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        const { batchId, leadIds, action = "approve" } = request;

        log(`[Debug] Processing batch ${batchId}, action=${action}, leadIds count=${leadIds?.length || 0}`);

        if (!batchId) {
            return res.json({ success: false, message: "batchId is required" }, 400);
        }

        log(`${action === "discard" ? "Discarding" : "Approving"} staged leads for batch ${batchId}...`);

        // Build query for staged leads
        const queries = [Query.equal("batchId", batchId)];

        if (leadIds && leadIds.length > 0) {
            // Approve specific leads
            queries.push(Query.equal("$id", leadIds));
        } else {
            // Approve all valid leads in batch (only if approving, if discarding we delete all)
            if (action === "approve") {
                queries.push(Query.equal("isValid", true));
            }
        }

        // Fetch staged leads to process
        const stagedResult = await databases.listDocuments(
            DATABASE_ID,
            CollectionId.STAGED_LEADS,
            [...queries, Query.limit(1000)]
        );

        let importedCount = 0;
        let deletedCount = 0;
        let skippedCount = 0;

        for (const doc of stagedResult.documents) {
            try {
                // Skip invalid leads if approving all (already filtered by query, but double check)
                if (action === "approve" && !doc.isValid && !leadIds) {
                    skippedCount++;
                    continue;
                }

                if (action === "approve") {
                    // Create lead in main collection
                    await databases.createDocument(
                        DATABASE_ID,
                        CollectionId.LEADS,
                        ID.unique(),
                        {
                            fullName: doc.fullName,
                            email: doc.email,
                            companyName: doc.companyName,
                            phoneNumber: doc.phoneNumber || null,
                            leadType: doc.leadType || null,
                            status: LeadStatus.PENDING_IMPORT,
                            isUnsubscribed: false,
                            metadata: doc.metadata || null,
                        },
                        [
                            Permission.read(Role.users()),
                            Permission.update(Role.users()),
                            Permission.delete(Role.users()),
                        ]
                    );

                    importedCount++;
                }

                // Delete from staging
                await databases.deleteDocument(DATABASE_ID, CollectionId.STAGED_LEADS, doc.$id);
                deletedCount++;

            } catch (err) {
                logErr(`Failed to process lead ${doc.$id}: ${err instanceof Error ? err.message : String(err)}`);
                skippedCount++;
            }
        }

        log(`Batch ${batchId}: Processed ${deletedCount} leads (Imported: ${importedCount}, Skipped: ${skippedCount})`);

        let message = action === "discard"
            ? `Discarded ${deletedCount} leads`
            : `Imported ${importedCount} leads, skipped ${skippedCount}`;

        // Debug info if nothing happened
        if (deletedCount === 0 && importedCount === 0 && skippedCount === 0) {
            const probe = await databases.listDocuments(
                DATABASE_ID,
                CollectionId.STAGED_LEADS,
                [Query.limit(1)]
            );
            const firstBatch = probe.documents[0]?.batchId;
            message += `. Debug: Req='${batchId}', FirstDB='${firstBatch}', TotalDB=${probe.total}`;
        }

        const response: ApproveStagedLeadsResponse = {
            success: true,
            imported: importedCount,
            skipped: skippedCount,
            message,
        };

        return res.json(response);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Approve staged leads error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}
