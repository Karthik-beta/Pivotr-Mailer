import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import * as ExcelJS from 'exceljs';

const logger = new Logger({ serviceName: 'api-leads-export' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const LEADS_TABLE = process.env.DYNAMODB_TABLE_LEADS || '';
const MAX_EXPORT_ROWS = 2000;

interface ExportRequest {
    campaignId?: string;
    status?: string;
    template?: boolean;
}

export const handler: APIGatewayProxyHandler = async (event) => {
    logger.info('Received export request', { path: event.path, httpMethod: event.httpMethod });

    try {
        // Handle Template Request (GET /leads/template or query param)
        const isTemplate = event.path.endsWith('/template') ||
            event.queryStringParameters?.template === 'true';

        if (isTemplate) {
            return await generateTemplate();
        }

        // Handle Export Request
        let request: ExportRequest = {};
        if (event.body) {
            try {
                request = JSON.parse(event.body);
            } catch {
                return response(400, { success: false, message: 'Invalid JSON body' });
            }
        }

        const { campaignId, status } = request;
        logger.info('Processing export', { campaignId, status });

        // Query Leads
        let items: any[] = [];

        if (campaignId) {
            // Query by CampaignId (and optional Status)
            const command = new QueryCommand({
                TableName: LEADS_TABLE,
                IndexName: 'CampaignIndex',
                KeyConditionExpression: 'campaignId = :cid',
                ExpressionAttributeValues: {
                    ':cid': campaignId,
                    ...(status && { ':status': status })
                },
                ...(status && { KeyConditionExpression: 'campaignId = :cid AND #status = :status', ExpressionAttributeNames: { '#status': 'status' } }),
                Limit: MAX_EXPORT_ROWS
            });
            const result = await docClient.send(command);
            items = result.Items || [];
        } else if (status) {
            // Query by Status
            const command = new QueryCommand({
                TableName: LEADS_TABLE,
                IndexName: 'StatusIndex',
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': status },
                Limit: MAX_EXPORT_ROWS
            });
            const result = await docClient.send(command);
            items = result.Items || [];
        } else {
            // Scan (Fallback/Export All)
            const command = new ScanCommand({
                TableName: LEADS_TABLE,
                Limit: MAX_EXPORT_ROWS
            });
            const result = await docClient.send(command);
            items = result.Items || [];
        }

        // Generate Excel
        const buffer = await generateExcel(items);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                data: buffer.toString('base64'),
                filename: `leads-export-${Date.now()}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            })
        };

    } catch (error) {
        logger.error('Export failed', { error });
        return response(500, { success: false, message: 'Internal Server Error' });
    }
};

async function generateExcel(leads: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    worksheet.columns = [
        { header: 'Full Name', key: 'fullName', width: 25 },
        { header: 'Email', key: 'email', width: 35 },
        { header: 'Company Name', key: 'companyName', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 20 },
    ];

    worksheet.addRows(leads);

    // Style Header
    worksheet.getRow(1).font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer()) as Buffer;
}

// Re-using the premium template logic from Appwrite function
async function generateTemplate(): Promise<APIGatewayProxyResult> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Pivotr Mailer";
    const sheet = workbook.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 10 }] });

    // Premium Slate Color Palette
    const C = {
        hero: "1E293B", heroText: "FFFFFF", muted: "94A3B8",
        panel: "F1F5F9", panelText: "334155", header: "0F172A",
        accent: "3B82F6", border: "E2E8F0", dataText: "374151",
    };

    sheet.columns = [
        { key: "A", width: 28 }, { key: "B", width: 40 },
        { key: "C", width: 28 }, { key: "D", width: 22 }, { key: "E", width: 16 },
    ];

    // Header styling logic (Simplified for brevity, but retaining visual structure)
    // Row 1: Hero
    sheet.mergeCells("A1:E1");
    const title = sheet.getCell("A1");
    title.value = "PIVOTR MAILER — LEAD IMPORT TEMPLATE";
    title.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: C.heroText } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.hero } };
    title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    sheet.getRow(1).height = 38;

    // Row 2: Subtitle
    sheet.mergeCells("A2:E2");
    const sub = sheet.getCell("A2");
    sub.value = "Complete the fields below. Do not modify column headers.";
    sub.font = { size: 11, color: { argb: C.muted } };
    sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.hero } };
    sheet.getRow(2).height = 24;

    // Row 10: Headers
    const headers = ["Full Name", "Email", "Company Name", "Phone Number", "Lead Type"];
    const hr = sheet.getRow(10);
    headers.forEach((h, i) => {
        const c = hr.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: C.heroText } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.header } };
    });
    hr.height = 28;

    // Data Validation
    for (let r = 11; r <= 500; r++) {
        sheet.getCell(`E${r}`).dataValidation = {
            type: "list", allowBlank: true, formulae: ['"HARDWARE,SOFTWARE,BOTH"']
        };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            data: Buffer.from(buffer).toString('base64'),
            filename: "pivotr-leads-template.xlsx",
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
    };
}

function response(statusCode: number, body: any): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body)
    };
}
