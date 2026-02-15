/**
 * Leads Export Lambda
 *
 * Exports leads to a professionally styled Excel spreadsheet.
 * Features:
 * - Premium design with modern color palette
 * - Status-based color coding
 * - Zebra striping for readability
 * - Frozen headers and summary statistics
 * - Strict TypeScript throughout
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import ExcelJS from 'exceljs';

// =============================================================================
// Configuration
// =============================================================================

const logger = new Logger({ serviceName: 'api-leads-export' });

const awsEndpoint = process.env.AWS_ENDPOINT_URL;
const awsRegion = process.env.AWS_REGION ?? 'us-east-1';

const clientConfig = awsEndpoint
    ? { region: awsRegion, endpoint: awsEndpoint }
    : { region: awsRegion };

const dynamoClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS ?? '';
const MAX_EXPORT_ROWS = 2000;

// =============================================================================
// TypeScript Interfaces
// =============================================================================

interface ExportRequest {
    readonly campaignId?: string;
    readonly status?: string;
    readonly template?: boolean;
}

interface Lead {
    readonly id: string;
    readonly fullName: string;
    readonly email: string;
    readonly companyName: string;
    readonly status: LeadStatus;
    readonly campaignId?: string;
    readonly leadType?: string;
    readonly phoneNumber?: string;
    readonly createdAt: string;
    readonly updatedAt?: string;
    readonly sentAt?: string;
    readonly lastMessageId?: string;
}

type LeadStatus =
    | 'PENDING_IMPORT'
    | 'VERIFIED'
    | 'QUEUED'
    | 'SENT'
    | 'DELIVERED'
    | 'BOUNCED'
    | 'COMPLAINED'
    | 'FAILED'
    | 'SKIPPED_DAILY_CAP'
    | 'UNSUBSCRIBED';

interface ColorPalette {
    readonly primary: string;
    readonly primaryText: string;
    readonly secondary: string;
    readonly secondaryText: string;
    readonly accent: string;
    readonly success: string;
    readonly warning: string;
    readonly danger: string;
    readonly muted: string;
    readonly border: string;
    readonly zebraLight: string;
    readonly zebraDark: string;
    readonly headerBg: string;
    readonly headerText: string;
}

interface StatusStyle {
    readonly bg: string;
    readonly text: string;
}

// =============================================================================
// Design System - Premium Color Palette
// =============================================================================

const COLORS: ColorPalette = {
    // Primary brand colors
    primary: '0F172A',      // Slate 900 - Deep navy
    primaryText: 'FFFFFF',  // White
    secondary: '1E293B',    // Slate 800
    secondaryText: 'F8FAFC', // Slate 50

    // Accent & semantic colors
    accent: '3B82F6',       // Blue 500
    success: '10B981',      // Emerald 500
    warning: 'F59E0B',      // Amber 500
    danger: 'EF4444',       // Red 500
    muted: '64748B',        // Slate 500

    // Table styling
    border: 'E2E8F0',       // Slate 200
    zebraLight: 'FFFFFF',   // White
    zebraDark: 'F8FAFC',    // Slate 50
    headerBg: '0F172A',     // Slate 900
    headerText: 'FFFFFF',   // White
};

const STATUS_STYLES: Record<LeadStatus, StatusStyle> = {
    PENDING_IMPORT: { bg: 'FEF3C7', text: '92400E' },  // Amber tones
    VERIFIED: { bg: 'DBEAFE', text: '1E40AF' },        // Blue tones
    QUEUED: { bg: 'E0E7FF', text: '3730A3' },          // Indigo tones
    SENT: { bg: 'CFFAFE', text: '0E7490' },            // Cyan tones
    DELIVERED: { bg: 'D1FAE5', text: '065F46' },       // Green tones
    BOUNCED: { bg: 'FEE2E2', text: '991B1B' },         // Red tones
    COMPLAINED: { bg: 'FCE7F3', text: '9D174D' },      // Pink tones
    FAILED: { bg: 'FEE2E2', text: '991B1B' },          // Red tones
    SKIPPED_DAILY_CAP: { bg: 'FEF3C7', text: '92400E' }, // Amber tones
    UNSUBSCRIBED: { bg: 'F3F4F6', text: '374151' },    // Gray tones
};

// =============================================================================
// Handler
// =============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
    logger.info('Received export request', { path: event.path, httpMethod: event.httpMethod });

    try {
        // Handle Template Request
        const isTemplate =
            event.path.endsWith('/template') ||
            event.queryStringParameters?.template === 'true';

        if (isTemplate) {
            return generateTemplate();
        }

        // Handle Export Selected Leads
        if (event.path.endsWith('/export-selected') && event.httpMethod === 'POST') {
            return await exportSelectedLeads(event.body);
        }

        // Parse request body
        let request: ExportRequest = {};
        if (event.body) {
            try {
                request = JSON.parse(event.body) as ExportRequest;
            } catch {
                return createResponse(400, { success: false, message: 'Invalid JSON body' });
            }
        }

        const { campaignId, status } = request;
        logger.info('Processing export', { campaignId, status });

        // Query leads from DynamoDB
        const leads = await fetchLeads(campaignId, status);
        logger.info('Fetched leads', { count: leads.length });

        // Generate styled Excel
        const buffer = await generatePremiumExcel(leads);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                data: buffer.toString('base64'),
                filename: `pivotr-leads-export-${formatDateForFilename(new Date())}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                recordCount: leads.length,
            }),
        };
    } catch (error) {
        logger.error('Export failed', { error });
        return createResponse(500, { success: false, message: 'Internal Server Error' });
    }
};

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchLeads(campaignId?: string, status?: string): Promise<Lead[]> {
    let items: Record<string, unknown>[] = [];

    if (campaignId && status) {
        // Query by Campaign AND Status (composite key)
        const command = new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: 'CampaignIndex',
            KeyConditionExpression: 'campaignId = :cid AND #status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':cid': campaignId, ':status': status },
            Limit: MAX_EXPORT_ROWS,
        });
        const result = await docClient.send(command);
        items = (result.Items ?? []) as Record<string, unknown>[];
    } else if (campaignId) {
        // Query by Campaign only
        const command = new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: 'CampaignIndex',
            KeyConditionExpression: 'campaignId = :cid',
            ExpressionAttributeValues: { ':cid': campaignId },
            Limit: MAX_EXPORT_ROWS,
        });
        const result = await docClient.send(command);
        items = (result.Items ?? []) as Record<string, unknown>[];
    } else if (status) {
        // Query by Status
        const command = new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': status },
            Limit: MAX_EXPORT_ROWS,
        });
        const result = await docClient.send(command);
        items = (result.Items ?? []) as Record<string, unknown>[];
    } else {
        // Scan all leads
        const command = new ScanCommand({
            TableName: LEADS_TABLE,
            Limit: MAX_EXPORT_ROWS,
        });
        const result = await docClient.send(command);
        items = (result.Items ?? []) as Record<string, unknown>[];
    }

    return items as unknown as Lead[];
}

/**
 * Export selected leads by IDs.
 */
async function exportSelectedLeads(body: string | null): Promise<APIGatewayProxyResult> {
    if (!body) {
        return createResponse(400, { success: false, message: 'Request body required' });
    }

    let request: { ids?: string[] };
    try {
        request = JSON.parse(body) as { ids?: string[] };
    } catch {
        return createResponse(400, { success: false, message: 'Invalid JSON body' });
    }

    const { ids } = request;

    if (!Array.isArray(ids) || ids.length === 0) {
        return createResponse(400, { success: false, message: 'ids array is required' });
    }

    // Limit batch size for safety
    if (ids.length > MAX_EXPORT_ROWS) {
        return createResponse(400, { success: false, message: `Maximum ${MAX_EXPORT_ROWS} leads can be exported at once` });
    }

    logger.info('Processing export-selected', { count: ids.length });

    // Fetch leads by IDs
    const leads = await fetchLeadsByIds(ids);
    logger.info('Fetched leads by IDs', { count: leads.length });

    // Generate styled Excel
    const buffer = await generatePremiumExcel(leads);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            data: buffer.toString('base64'),
            filename: `pivotr-leads-export-selected-${formatDateForFilename(new Date())}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            recordCount: leads.length,
        }),
    };
}

/**
 * Fetch leads by IDs using BatchGet.
 */
async function fetchLeadsByIds(ids: string[]): Promise<Lead[]> {
    if (ids.length === 0) return [];

    // DynamoDB BatchGet supports up to 100 items per request
    const batchSize = 100;
    const allItems: Lead[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const keys = batch.map(id => ({ id }));

        const command = new BatchGetCommand({
            RequestItems: {
                [LEADS_TABLE]: {
                    Keys: keys,
                },
            },
        });

        const result = await docClient.send(command);
        const items = result.Responses?.[LEADS_TABLE] ?? [];
        allItems.push(...(items as Lead[]));
    }

    return allItems;
}

// =============================================================================
// Excel Generation - Premium Export
// =============================================================================

async function generatePremiumExcel(leads: Lead[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // Workbook metadata
    workbook.creator = 'Pivotr Mailer';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Leads Export', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }], // Freeze first 4 rows
        properties: { defaultRowHeight: 22 },
    });

    // ==========================================================================
    // Column Definitions
    // ==========================================================================

    const columns: Partial<ExcelJS.Column>[] = [
        { key: 'fullName', width: 28 },
        { key: 'email', width: 38 },
        { key: 'companyName', width: 28 },
        { key: 'status', width: 18 },
        { key: 'leadType', width: 14 },
        { key: 'phoneNumber', width: 18 },
        { key: 'createdAt', width: 20 },
        { key: 'sentAt', width: 20 },
    ];

    worksheet.columns = columns;

    // ==========================================================================
    // Row 1: Hero Header
    // ==========================================================================

    worksheet.mergeCells('A1:H1');
    const heroCell = worksheet.getCell('A1');
    heroCell.value = 'PIVOTR MAILER — LEADS EXPORT';
    heroCell.font = {
        name: 'Segoe UI',
        size: 18,
        bold: true,
        color: { argb: COLORS.primaryText },
    };
    heroCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.primary },
    };
    heroCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 42;

    // ==========================================================================
    // Row 2: Subtitle with export metadata
    // ==========================================================================

    worksheet.mergeCells('A2:H2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Exported on ${formatDateTime(new Date())} • ${leads.length.toLocaleString()} records`;
    subtitleCell.font = {
        name: 'Segoe UI',
        size: 11,
        color: { argb: COLORS.muted },
    };
    subtitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.secondary },
    };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(2).height = 26;

    // ==========================================================================
    // Row 3: Spacer
    // ==========================================================================

    worksheet.getRow(3).height = 8;

    // ==========================================================================
    // Row 4: Column Headers
    // ==========================================================================

    const headerLabels = [
        'Full Name',
        'Email Address',
        'Company',
        'Status',
        'Lead Type',
        'Phone',
        'Created',
        'Sent At',
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.height = 32;

    headerLabels.forEach((label, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = label;
        cell.font = {
            name: 'Segoe UI',
            size: 11,
            bold: true,
            color: { argb: COLORS.headerText },
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.headerBg },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.border = {
            bottom: { style: 'medium', color: { argb: COLORS.accent } },
        };
    });

    // ==========================================================================
    // Data Rows with Premium Styling
    // ==========================================================================

    leads.forEach((lead, index) => {
        const rowNumber = index + 5; // Data starts at row 5
        const row = worksheet.getRow(rowNumber);
        const isEvenRow = index % 2 === 0;

        // Add data
        row.getCell(1).value = lead.fullName ?? '';
        row.getCell(2).value = lead.email ?? '';
        row.getCell(3).value = lead.companyName ?? '';
        row.getCell(4).value = lead.status ?? '';
        row.getCell(5).value = lead.leadType ?? '';
        row.getCell(6).value = lead.phoneNumber ?? '';
        row.getCell(7).value = formatDateShort(lead.createdAt);
        row.getCell(8).value = lead.sentAt ? formatDateShort(lead.sentAt) : '';

        // Base row styling (zebra striping)
        const zebraColor = isEvenRow ? COLORS.zebraLight : COLORS.zebraDark;

        for (let col = 1; col <= 8; col++) {
            const cell = row.getCell(col);
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                color: { argb: '374151' },
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: zebraColor },
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            cell.border = {
                bottom: { style: 'thin', color: { argb: COLORS.border } },
            };
        }

        // Status cell with semantic coloring
        const statusCell = row.getCell(4);
        const statusStyle = STATUS_STYLES[lead.status] ?? { bg: 'F3F4F6', text: '374151' };
        statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: statusStyle.bg },
        };
        statusCell.font = {
            name: 'Segoe UI',
            size: 10,
            bold: true,
            color: { argb: statusStyle.text },
        };
        statusCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Email styling - make it look like a link
        const emailCell = row.getCell(2);
        emailCell.font = {
            name: 'Segoe UI',
            size: 10,
            color: { argb: COLORS.accent },
            underline: true,
        };

        row.commit();
    });

    // ==========================================================================
    // Summary Footer
    // ==========================================================================

    if (leads.length > 0) {
        const summaryRowNum = leads.length + 6;
        worksheet.getRow(summaryRowNum - 1).height = 8; // Spacer

        worksheet.mergeCells(`A${summaryRowNum}:H${summaryRowNum}`);
        const summaryCell = worksheet.getCell(`A${summaryRowNum}`);

        // Calculate status breakdown
        const statusCounts = calculateStatusBreakdown(leads);
        const summaryText = Object.entries(statusCounts)
            .map(([status, count]) => `${status}: ${count}`)
            .join('  •  ');

        summaryCell.value = `Summary: ${summaryText}`;
        summaryCell.font = {
            name: 'Segoe UI',
            size: 10,
            italic: true,
            color: { argb: COLORS.muted },
        };
        summaryCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.zebraDark },
        };
        summaryCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        summaryCell.border = {
            top: { style: 'thin', color: { argb: COLORS.border } },
        };
        worksheet.getRow(summaryRowNum).height = 28;
    }

    // ==========================================================================
    // Auto-filter on headers
    // ==========================================================================

    if (leads.length > 0) {
        worksheet.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: leads.length + 4, column: 8 },
        };
    }

    // ==========================================================================
    // Write to buffer
    // ==========================================================================

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}

// =============================================================================
// Template Generation (Premium Import Template)
// =============================================================================

async function generateTemplate(): Promise<APIGatewayProxyResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Pivotr Mailer';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Leads Import', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 10 }],
        properties: { defaultRowHeight: 24 },
    });

    // Column definitions
    worksheet.columns = [
        { key: 'A', width: 28 },
        { key: 'B', width: 40 },
        { key: 'C', width: 28 },
        { key: 'D', width: 22 },
        { key: 'E', width: 16 },
    ];

    // ==========================================================================
    // Row 1: Hero Header
    // ==========================================================================

    worksheet.mergeCells('A1:E1');
    const heroCell = worksheet.getCell('A1');
    heroCell.value = 'PIVOTR MAILER — LEAD IMPORT TEMPLATE';
    heroCell.font = {
        name: 'Segoe UI',
        size: 16,
        bold: true,
        color: { argb: COLORS.primaryText },
    };
    heroCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.primary },
    };
    heroCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(1).height = 38;

    // ==========================================================================
    // Row 2: Subtitle
    // ==========================================================================

    worksheet.mergeCells('A2:E2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = 'Complete the fields below. Do not modify column headers.';
    subtitleCell.font = {
        name: 'Segoe UI',
        size: 11,
        color: { argb: COLORS.muted },
    };
    subtitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.secondary },
    };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    worksheet.getRow(2).height = 26;

    // ==========================================================================
    // Rows 3-9: Instructions Panel
    // ==========================================================================

    const instructions = [
        '📋 INSTRUCTIONS:',
        '• Full Name: Enter the complete name (first and last)',
        '• Email: Valid email address (required)',
        '• Company Name: Organization name (required)',
        '• Phone Number: Include country code (optional)',
        '• Lead Type: Select from dropdown (HARDWARE/SOFTWARE/BOTH)',
        '',
    ];

    instructions.forEach((text, idx) => {
        const rowNum = idx + 3;
        worksheet.mergeCells(`A${rowNum}:E${rowNum}`);
        const cell = worksheet.getCell(`A${rowNum}`);
        cell.value = text;
        cell.font = {
            name: 'Segoe UI',
            size: 10,
            bold: idx === 0,
            color: { argb: idx === 0 ? COLORS.accent : '64748B' },
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F1F5F9' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    });

    // ==========================================================================
    // Row 10: Column Headers
    // ==========================================================================

    const headers = ['Full Name', 'Email', 'Company Name', 'Phone Number', 'Lead Type'];
    const headerRow = worksheet.getRow(10);
    headerRow.height = 32;

    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = {
            name: 'Segoe UI',
            size: 11,
            bold: true,
            color: { argb: COLORS.headerText },
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: COLORS.headerBg },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.border = {
            bottom: { style: 'medium', color: { argb: COLORS.accent } },
        };
    });

    // ==========================================================================
    // Sample Data Rows (rows 11-13) - Examples for users
    // ==========================================================================

    const sampleData = [
        {
            fullName: 'Rahul Sharma',
            email: 'rahul.sharma@techsolutions.com',
            companyName: 'Tech Solutions Pvt Ltd',
            phoneNumber: '+91 98765 43210',
            leadType: 'SOFTWARE',
        },
        {
            fullName: 'Priya Patel',
            email: 'priya.p@innovate.co.in',
            companyName: 'Innovate Industries',
            phoneNumber: '+91 87654 32109',
            leadType: 'HARDWARE',
        },
        {
            fullName: 'Amit Kumar',
            email: 'amit.kumar@globaltech.com',
            companyName: 'Global Tech Enterprises',
            phoneNumber: '+91 76543 21098',
            leadType: 'BOTH',
        },
    ];

    sampleData.forEach((sample, idx) => {
        const rowNum = 11 + idx;
        const row = worksheet.getRow(rowNum);
        row.height = 24;

        // Full Name
        const nameCell = row.getCell(1);
        nameCell.value = sample.fullName;
        nameCell.font = { name: 'Segoe UI', size: 10, color: { argb: '374151' }, italic: true };
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        nameCell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        nameCell.alignment = { vertical: 'middle', indent: 1 };

        // Email
        const emailCell = row.getCell(2);
        emailCell.value = sample.email;
        emailCell.font = { name: 'Segoe UI', size: 10, color: { argb: '374151' }, italic: true };
        emailCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        emailCell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        emailCell.alignment = { vertical: 'middle', indent: 1 };

        // Company Name
        const companyCell = row.getCell(3);
        companyCell.value = sample.companyName;
        companyCell.font = { name: 'Segoe UI', size: 10, color: { argb: '374151' }, italic: true };
        companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        companyCell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        companyCell.alignment = { vertical: 'middle', indent: 1 };

        // Phone Number
        const phoneCell = row.getCell(4);
        phoneCell.value = sample.phoneNumber;
        phoneCell.font = { name: 'Segoe UI', size: 10, color: { argb: '374151' }, italic: true };
        phoneCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        phoneCell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        phoneCell.alignment = { vertical: 'middle', indent: 1 };

        // Lead Type
        const typeCell = row.getCell(5);
        typeCell.value = sample.leadType;
        typeCell.font = { name: 'Segoe UI', size: 10, color: { argb: '374151' }, italic: true };
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        typeCell.border = { bottom: { style: 'hair', color: { argb: COLORS.border } } };
        typeCell.alignment = { vertical: 'middle', indent: 1 };

        // Lead Type dropdown validation for sample rows
        typeCell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"HARDWARE,SOFTWARE,BOTH"'],
            error: 'Please select a valid lead type',
            errorTitle: 'Invalid Selection',
            showErrorMessage: true,
        };
    });

    // ==========================================================================
    // Empty Data Rows with validation and zebra striping (rows 14-510)
    // ==========================================================================

    for (let rowNum = 14; rowNum <= 510; rowNum++) {
        const isEvenRow = (rowNum - 14) % 2 === 0;
        const zebraColor = isEvenRow ? COLORS.zebraLight : COLORS.zebraDark;

        for (let col = 1; col <= 5; col++) {
            const cell = worksheet.getCell(rowNum, col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: zebraColor },
            };
            cell.border = {
                bottom: { style: 'hair', color: { argb: COLORS.border } },
            };
            cell.font = {
                name: 'Segoe UI',
                size: 10,
                color: { argb: '374151' },
            };
        }

        // Lead Type dropdown validation
        worksheet.getCell(`E${rowNum}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"HARDWARE,SOFTWARE,BOTH"'],
            error: 'Please select a valid lead type',
            errorTitle: 'Invalid Selection',
            showErrorMessage: true,
        };
    }

    // ==========================================================================
    // Write buffer
    // ==========================================================================

    const arrayBuffer = await workbook.xlsx.writeBuffer();

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
            data: Buffer.from(arrayBuffer).toString('base64'),
            filename: 'pivotr-leads-template.xlsx',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

function createResponse(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResult {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(body),
    };
}

function formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

function formatDateShort(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return dateString;
    }
}

function formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0] ?? '';
}

function calculateStatusBreakdown(leads: Lead[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
        const status = lead.status ?? 'UNKNOWN';
        counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
}
