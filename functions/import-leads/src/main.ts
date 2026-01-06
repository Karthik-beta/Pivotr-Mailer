/**
 * Import Leads Function — Main Entry Point
 *
 * This Appwrite Function handles bulk lead imports from CSV or Excel files.
 * It provides data sanitization and duplicate detection.
 *
 * API:
 *   POST / - Import leads from uploaded file
 *   Body: { campaignId?: string, data: LeadImportRow[] }
 */

import { Client } from 'node-appwrite';
import { EventType } from './lib/shared/constants/event.constants';
import { LeadStatus } from './lib/shared/constants/status.constants';

// Shared modules
import { createLead, findLeadByEmail } from './lib/shared/database/repositories/lead.repository';
import { logError, logInfo } from './lib/shared/database/repositories/log.repository';
import { incrementGlobalMetrics } from './lib/shared/database/repositories/metrics.repository';

/**
 * Lead import row structure
 */
interface LeadImportRow {
	fullName: string;
	email: string;
	companyName: string;
	metadata?: Record<string, unknown>;
}

/**
 * Import request body
 */
interface ImportRequest {
	campaignId?: string;
	data: LeadImportRow[];
}

/**
 * Import result
 */
interface ImportResult {
	total: number;
	imported: number;
	duplicates: number;
	invalid: number;
	errors: string[];
}

/**
 * Appwrite Function context
 */
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

/**
 * Main entry point for the Import Leads Function.
 */
export default async function main(context: AppwriteContext): Promise<unknown> {
	const { req, res, log, error: logErr } = context;

	let endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || '';
	const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID || '';

	// Fix for Appwrite Docker: use internal service name
	if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
		endpoint = endpoint.replace('localhost', 'appwrite').replace('127.0.0.1', 'appwrite');
	}

	// Initialize Appwrite client
	const client = new Client()
		.setEndpoint(endpoint)
		.setProject(projectId)
		.setKey(process.env.APPWRITE_API_KEY || '')
		.setSelfSigned(true);

	try {
		// Parse request body
		let request: ImportRequest;
		try {
			request = JSON.parse(req.body || '{}');
		} catch {
			return res.json({ success: false, message: 'Invalid JSON body' }, 400);
		}

		const { campaignId, data } = request;

		if (!data || !Array.isArray(data) || data.length === 0) {
			return res.json({ success: false, message: 'No data provided' }, 400);
		}

		log(`Importing ${data.length} leads...`);

		const result = await importLeads(client, data, campaignId);

		await logInfo(
			client,
			EventType.LEAD_IMPORTED,
			`Imported ${result.imported} leads (${result.duplicates} duplicates, ${result.invalid} invalid)`,
			{
				campaignId,
				metadata: result as unknown as Record<string, unknown>
			}
		);

		// Update global metrics
		await incrementGlobalMetrics(client, { totalLeadsImported: result.imported });

		return res.json({
			success: true,
			message: `Imported ${result.imported} of ${result.total} leads`,
			data: result,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logErr(`Import error: ${message}`);

		await logError(client, EventType.SYSTEM_ERROR, `Import error: ${message}`, {});

		return res.json({ success: false, message }, 500);
	}
}

/**
 * Import leads with sanitization and duplicate detection.
 */
async function importLeads(
	client: Client,
	rows: LeadImportRow[],
	campaignId?: string
): Promise<ImportResult> {
	const result: ImportResult = {
		total: rows.length,
		imported: 0,
		duplicates: 0,
		invalid: 0,
		errors: [],
	};

	let queuePosition = 1;

	for (const row of rows) {
		try {
			// Sanitize data
			const sanitized = sanitizeRow(row);

			// Validate
			const validationErrors = validateRow(sanitized);
			if (validationErrors.length > 0) {
				result.invalid++;
				result.errors.push(`Row ${result.total - rows.length + 1}: ${validationErrors.join(', ')}`);
				continue;
			}

			// Check for duplicates
			const existing = await findLeadByEmail(client, sanitized.email);
			if (existing) {
				result.duplicates++;
				continue;
			}

			// Create lead
			await createLead(client, {
				fullName: sanitized.fullName,
				email: sanitized.email,
				companyName: sanitized.companyName,
				status: campaignId ? LeadStatus.QUEUED : LeadStatus.PENDING_IMPORT,
				campaignId: campaignId,
				queuePosition: campaignId ? queuePosition++ : undefined,
				metadata: row.metadata,
			});

			result.imported++;
		} catch (err) {
			result.errors.push(`Row error: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	return result;
}

/**
 * Sanitize a lead import row.
 */
function sanitizeRow(row: LeadImportRow): LeadImportRow {
	return {
		fullName: sanitizeText(row.fullName || ''),
		email: sanitizeEmail(row.email || ''),
		companyName: sanitizeText(row.companyName || ''),
		metadata: row.metadata,
	};
}

/**
 * Sanitize text field.
 */
function sanitizeText(text: string): string {
	return (
		text
			// Remove invisible characters
			.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
			// Normalize whitespace
			.replace(/\s+/g, ' ')
			// Trim
			.trim()
	);
}

/**
 * Sanitize email field.
 */
function sanitizeEmail(email: string): string {
	return (
		email
			// Remove invisible characters
			.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
			// Remove whitespace
			.replace(/\s/g, '')
			// Lowercase
			.toLowerCase()
			// Trim
			.trim()
	);
}

/**
 * Validate a sanitized row.
 */
function validateRow(row: LeadImportRow): string[] {
	const errors: string[] = [];

	if (!row.fullName) {
		errors.push('fullName is required');
	}

	if (!row.email) {
		errors.push('email is required');
	} else if (!isValidEmail(row.email)) {
		errors.push('invalid email format');
	}

	if (!row.companyName) {
		errors.push('companyName is required');
	}

	return errors;
}

/**
 * Validate email format using RFC 5322 regex.
 */
function isValidEmail(email: string): boolean {
	// RFC 5322 compliant regex (simplified)
	const emailRegex =
		/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	return emailRegex.test(email);
}
