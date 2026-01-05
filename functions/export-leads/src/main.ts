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
            return await downloadTemplate(res);
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
 * Generate a professionally styled Excel template using exceljs
 * 
 * Design: Premium slate theme with bold visual hierarchy
 * - Dark hero banner with brand identity
 * - Instructions in soft panel with checkmark icons
 * - Data headers with dark background and accent underline
 * - Frozen panes, data validation dropdown
 */
async function downloadTemplate(res: AppwriteContext["res"]): Promise<unknown> {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Pivotr Mailer";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Leads", {
        views: [{ state: "frozen", ySplit: 10 }]
    });

    // Premium Slate Color Palette
    const C = {
        hero: "1E293B",      // Slate 800 - Dark hero
        heroText: "FFFFFF",  // White
        muted: "94A3B8",     // Slate 400 - Subtle text
        panel: "F1F5F9",     // Slate 100 - Soft panel
        panelText: "334155", // Slate 700
        header: "0F172A",    // Slate 900 - Bold header
        accent: "3B82F6",    // Blue 500 - Accent line
        border: "E2E8F0",    // Slate 200
        dataText: "374151",  // Gray 700
    };

    // Column setup
    sheet.columns = [
        { key: "A", width: 28 },
        { key: "B", width: 40 },
        { key: "C", width: 28 },
        { key: "D", width: 22 },
        { key: "E", width: 16 },
    ];

    // ═══════════════════════════════════════════
    // ROW 1: HERO TITLE
    // ═══════════════════════════════════════════
    sheet.mergeCells("A1:E1");
    const title = sheet.getCell("A1");
    title.value = "PIVOTR MAILER — LEAD IMPORT TEMPLATE";
    title.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: C.heroText } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.hero } };
    title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(1).height = 38;

    // ═══════════════════════════════════════════
    // ROW 2: SUBTITLE
    // ═══════════════════════════════════════════
    sheet.mergeCells("A2:E2");
    const subtitle = sheet.getCell("A2");
    subtitle.value = "Complete the fields below. Do not modify column headers.";
    subtitle.font = { name: "Segoe UI", size: 11, color: { argb: C.muted } };
    subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.hero } };
    subtitle.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(2).height = 24;

    // ROW 3: Hero bottom spacer
    sheet.mergeCells("A3:E3");
    sheet.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.hero } };
    sheet.getRow(3).height = 6;

    // ═══════════════════════════════════════════
    // ROW 4: INSTRUCTIONS HEADER
    // ═══════════════════════════════════════════
    sheet.mergeCells("A4:E4");
    const instHeader = sheet.getCell("A4");
    instHeader.value = "INSTRUCTIONS";
    instHeader.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: C.panelText } };
    instHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.panel } };
    instHeader.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(4).height = 26;

    // ═══════════════════════════════════════════
    // ROWS 5-8: INSTRUCTION ITEMS
    // ═══════════════════════════════════════════
    const instructions = [
        "✓  Required: Full Name, Email, Company Name",
        "✓  Lead Type: HARDWARE, SOFTWARE, or BOTH",
        "✓  Invalid emails flagged during import review",
        "✓  Phone format: +91 XXXXX XXXXX (optional)"
    ];

    instructions.forEach((txt, i) => {
        const rn = 5 + i;
        sheet.mergeCells(`A${rn}:E${rn}`);
        const c = sheet.getCell(`A${rn}`);
        c.value = txt;
        c.font = { name: "Segoe UI", size: 10, color: { argb: C.panelText } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.panel } };
        c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        sheet.getRow(rn).height = 20;
    });

    // ROW 9: Separator
    sheet.getRow(9).height = 10;

    // ═══════════════════════════════════════════
    // ROW 10: DATA HEADERS
    // ═══════════════════════════════════════════
    const headers = ["Full Name", "Email", "Company Name", "Phone Number", "Lead Type"];
    const hr = sheet.getRow(10);

    headers.forEach((h, i) => {
        const cell = hr.getCell(i + 1);
        cell.value = h;
        cell.font = { name: "Segoe UI", size: 11, bold: true, color: { argb: C.heroText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.header } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { bottom: { style: "medium", color: { argb: C.accent } } };
    });
    hr.height = 28;

    // ═══════════════════════════════════════════
    // ROWS 11-12: SAMPLE DATA
    // ═══════════════════════════════════════════
    const samples = [
        ["Rajesh Kumar", "rajesh.kumar@example.in", "Bharat Solutions", "+91 98765 43210", "HARDWARE"],
        ["Priya Sharma", "priya.sharma@techindia.co.in", "Indo Tech", "+91 91234 56789", "SOFTWARE"]
    ];

    samples.forEach((data, ri) => {
        const row = sheet.getRow(11 + ri);
        data.forEach((val, ci) => {
            const cell = row.getCell(ci + 1);
            cell.value = val;
            cell.font = { name: "Segoe UI", size: 10, color: { argb: C.dataText } };
            cell.alignment = { vertical: "middle", horizontal: "left" };
            cell.border = {
                bottom: { style: "thin", color: { argb: C.border } },
                left: { style: "thin", color: { argb: C.border } },
                right: { style: "thin", color: { argb: C.border } }
            };
        });
        row.height = 22;
    });

    // ═══════════════════════════════════════════
    // DATA VALIDATION: Lead Type (E11:E500)
    // ═══════════════════════════════════════════
    for (let r = 11; r <= 500; r++) {
        sheet.getCell(`E${r}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"HARDWARE,SOFTWARE,BOTH"'],
            showErrorMessage: true,
            errorTitle: "Invalid Lead Type",
            error: "Select HARDWARE, SOFTWARE, or BOTH"
        };
    }

    // Light border guides for empty data rows
    for (let r = 13; r <= 50; r++) {
        for (let c = 1; c <= 5; c++) {
            sheet.getRow(r).getCell(c).border = {
                bottom: { style: "hair", color: { argb: C.border } },
                left: { style: "hair", color: { argb: C.border } },
                right: { style: "hair", color: { argb: C.border } }
            };
        }
    }

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return res.json({
        data: Buffer.from(buffer).toString("base64"),
        filename: "pivotr-leads-template.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
}

