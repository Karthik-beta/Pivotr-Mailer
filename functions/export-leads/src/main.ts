/**
 * Export Leads Function
 *
 * Generates Excel file with lead data for download.
 *
 * API:
 *   POST / - Export leads to Excel
 *   Body: { campaignId?: string, status?: string, format: "xlsx" }
 *   GET /?template=true - Download empty template
 */

import { Client, Databases, Query } from "node-appwrite";
import * as XLSX from "xlsx";
import { CollectionId, DATABASE_ID } from "./definitions";
import type { ExportLeadsRequest } from "./definitions";

interface AppwriteContext {
    req: {
        body: string;
        headers: Record<string, string>;
        method: string;
        query: Record<string, string>;
    };
    res: {
        json: (data: unknown, statusCode?: number) => unknown;
        binary: (data: Buffer, statusCode?: number) => unknown;
        send: (data: string, statusCode?: number, headers?: Record<string, string>) => unknown;
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
        // Parse request body
        let request: Partial<ExportLeadsRequest> = {};
        try {
            request = JSON.parse(req.body || "{}");
        } catch {
            return res.json({ success: false, message: "Invalid JSON body" }, 400);
        }

        // Check for template download (Query param OR Body param)
        if (req.query?.template === "true" || req.method === "GET" || request.template) {
            return downloadTemplate(res);
        }

        log("Exporting leads to Excel...");

        // Build query
        const queries: string[] = [Query.limit(1000), Query.orderDesc("$createdAt")];

        if (request.campaignId) {
            queries.push(Query.equal("campaignId", request.campaignId));
        }

        if (request.status) {
            queries.push(Query.equal("status", request.status));
        }

        // Fetch leads
        const result = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, queries);

        // Transform to export format
        const exportData = result.documents.map((doc) => ({
            "Full Name": doc.fullName,
            Email: doc.email,
            "Company Name": doc.companyName,
            Status: doc.status,
            "Created At": doc.$createdAt,
        }));

        // Create workbook
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

        // Set column widths
        worksheet["!cols"] = [
            { wch: 25 }, // Full Name
            { wch: 35 }, // Email
            { wch: 25 }, // Company Name
            { wch: 15 }, // Status
            { wch: 20 }, // Created At
        ];

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        log(`Exported ${result.documents.length} leads`);

        // Return as binary with proper headers
        return res.json({
            data: buffer.toString("base64"),
            filename: `leads-export-${Date.now()}.xlsx`,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logErr(`Export leads error: ${message}`);
        return res.json({ success: false, message }, 500);
    }
}

/**
 * Generate and download excel template with instructions
 */
function downloadTemplate(res: AppwriteContext["res"]): unknown {
    // Create workbook with instructions
    const workbook = XLSX.utils.book_new();

    // 1. Instructions Sheet
    const instructionsData = [
        { "Instruction": "1. Do not change column headers in the 'Leads' sheet." },
        { "Instruction": "2. 'Full Name', 'Email', and 'Company Name' are required." },
        { "Instruction": "3. 'Lead Type' must be one of: HARDWARE, SOFTWARE, or BOTH." },
        { "Instruction": "4. Rows with invalid emails will be flagged during import." },
    ];
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");
    instructionsSheet["!cols"] = [{ wch: 80 }];

    // 2. Data Template Sheet
    const templateRows = [
        {
            "Full Name": "Rajesh Kumar",
            "Email": "rajesh.kumar@example.in",
            "Company Name": "Bharat Solutions",
            "Phone Number": "+91 98765 43210",
            "Lead Type": "HARDWARE"
        },
        {
            "Full Name": "Priya Sharma",
            "Email": "priya.sharma@techindia.co.in",
            "Company Name": "Indo Tech",
            "Phone Number": "+91 91234 56789",
            "Lead Type": "SOFTWARE"
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    // Set column widths
    worksheet["!cols"] = [
        { wch: 25 }, // Full Name
        { wch: 35 }, // Email
        { wch: 25 }, // Company Name
        { wch: 20 }, // Phone Number
        { wch: 15 }, // Lead Type
    ];

    // Write to buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Verify buffer is actually a buffer
    const finalBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    return res.json({
        data: finalBuffer.toString("base64"),
        filename: "leads-import-template.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
}
