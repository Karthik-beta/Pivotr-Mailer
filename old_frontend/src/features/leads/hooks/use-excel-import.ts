import type { StagedLead, StagedLeadCreateInput } from "@shared/types/staged-lead.types";
import { validateStagedLead } from "@shared/validation/lead-validator";
import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { functions } from "@/lib/appwrite";

interface ParsedFileData {
	batchId: string;
	leads: StagedLead[];
}

interface UseExcelImportResult {
	// State
	isLoading: boolean;
	isUploading: boolean;
	stagedLeads: StagedLead[];
	summary: {
		total: number;
		valid: number;
		invalid: number;
		warnings: number;
	} | null;
	batchId: string | null;
	error: string | null;

	// Actions
	parseFile: (file: File) => Promise<ParsedFileData | null>;
	updateLead: (rowNumber: number, field: keyof StagedLead, value: string) => void;
	removeLead: (rowNumber: number) => void;
	saveToStaging: (overrideBatchId?: string, overrideLeads?: StagedLead[]) => Promise<boolean>;
	reset: () => void;
}

/**
 * Hook for managing Excel import workflow with client-side validation
 */
export function useExcelImport(): UseExcelImportResult {
	const [isLoading, setIsLoading] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [stagedLeads, setStagedLeads] = useState<StagedLead[]>([]);
	const [summary, setSummary] = useState<UseExcelImportResult["summary"]>(null);
	const [batchId, setBatchId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Parse Excel/CSV file and validate each row
	 */
	const parseFile = useCallback(async (file: File): Promise<ParsedFileData | null> => {
		setIsLoading(true);
		setError(null);

		try {
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data, { type: "array" });

			// Get first sheet
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];

			// Find header row dynamically
			const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
			let headerRowIndex = 0;

			// Scan first 20 rows for a likely header row
			let maxMatches = 0;

			for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
				const row = rawRows[i];
				if (!Array.isArray(row) || row.length === 0) continue;

				// Count how many cells look like valid headers
				const matches = row.filter(cell => {
					if (typeof cell !== 'string') return false;
					const val = cell.trim();
					// Ignore long instruction text (headers are usually short)
					if (val.length > 50) return false;

					const lower = val.toLowerCase();
					return ['email', 'name', 'company', 'phone', 'mobile', 'type'].some(k => lower.includes(k));
				}).length;

				// Prefer the row with the most header matches
				// A real header row will typically have multiple matches (e.g. Email, Name, Company)
				// An instruction row usually puts all text in one cell (1 match)
				if (matches > maxMatches) {
					maxMatches = matches;
					headerRowIndex = i;
				}

				// Early exit if we found a very clear header row
				if (matches >= 3) {
					headerRowIndex = i;
					break;
				}
			}

			// Convert to JSON array starting from valid header
			const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { range: headerRowIndex });

			if (rows.length === 0) {
				throw new Error("No data found in file");
			}

			console.log("[ExcelImport] Header Row Index:", headerRowIndex);
			if (rows.length > 0) {
				console.log("[ExcelImport] First Row Keys:", Object.keys(rows[0]));
				console.log("[ExcelImport] First Row Data:", rows[0]);
			}

			// Generate batch ID
			const newBatchId = crypto.randomUUID();
			setBatchId(newBatchId);

			// Map and validate each row
			const leads: StagedLead[] = rows.map((row, index) => {
				// Helper to find value case-insensitively
				const getValue = (candidates: string[]): string => {
					const rowKeys = Object.keys(row);
					for (const candidate of candidates) {
						// Exact match first
						if (row[candidate] !== undefined) return String(row[candidate]);

						// Case-insensitive match
						const foundKey = rowKeys.find(k => k.toLowerCase().trim() === candidate.toLowerCase().trim());
						if (foundKey && row[foundKey] !== undefined) return String(row[foundKey]);
					}
					return "";
				};

				// Normalize column names (handle various formats)
				const fullName = getValue(["Full Name", "fullName", "Name", "name", "Customer Name"]);
				const email = getValue(["Email", "email", "E-mail", "Email Address"]);
				const companyName = getValue(["Company Name", "companyName", "Company", "company", "Organization"]);
				const phoneNumber = getValue(["Phone Number", "phoneNumber", "Phone", "phone", "Mobile", "Cell"]);
				const leadType = getValue(["Lead Type", "leadType", "Type", "type"]);

				// Normalize leadType value
				let normalizedLeadType: string | null = null;
				if (leadType) {
					const upper = leadType.toUpperCase().trim();
					if (upper === "HARDWARE" || upper === "SOFTWARE" || upper === "BOTH") {
						normalizedLeadType = upper;
					}
				}

				// Validate
				const { issues, isValid } = validateStagedLead({
					fullName: fullName.trim(),
					email: email.trim(),
					companyName: companyName.trim(),
				});

				return {
					batchId: newBatchId,
					rowNumber: index + 1, // Sequential row number starting from 1
					fullName: fullName.trim(),
					email: email.trim(),
					companyName: companyName.trim(),
					phoneNumber: phoneNumber.trim() || null,
					leadType: normalizedLeadType as "HARDWARE" | "SOFTWARE" | "BOTH" | null,
					validationErrors: issues,
					isValid,
					importedAt: new Date().toISOString(),
				};
			});

			setStagedLeads(leads);

			// Calculate summary
			const validCount = leads.filter((l) => l.isValid).length;
			const invalidCount = leads.filter((l) => !l.isValid).length;
			const warningCount = leads.filter(
				(l) => l.isValid && l.validationErrors.some((e) => e.severity === "warning")
			).length;

			setSummary({
				total: leads.length,
				valid: validCount,
				invalid: invalidCount,
				warnings: warningCount,
			});

			// Return parsed data for immediate use (avoids state timing issues)
			return { batchId: newBatchId, leads };
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to parse file");
			setStagedLeads([]);
			setSummary(null);
			return null;
		} finally {
			setIsLoading(false);
		}
	}, []);

	/**
	 * Update a lead field and revalidate
	 */
	const updateLead = useCallback((rowNumber: number, field: keyof StagedLead, value: string) => {
		setStagedLeads((prev) => {
			return prev.map((lead) => {
				if (lead.rowNumber !== rowNumber) return lead;

				const updated = { ...lead, [field]: value };

				// Revalidate
				const { issues, isValid } = validateStagedLead({
					fullName: updated.fullName,
					email: updated.email,
					companyName: updated.companyName,
				});

				return {
					...updated,
					validationErrors: issues,
					isValid,
				};
			});
		});

		// Recalculate summary
		setStagedLeads((prev) => {
			const validCount = prev.filter((l) => l.isValid).length;
			const invalidCount = prev.filter((l) => !l.isValid).length;
			const warningCount = prev.filter(
				(l) => l.isValid && l.validationErrors.some((e) => e.severity === "warning")
			).length;

			setSummary({
				total: prev.length,
				valid: validCount,
				invalid: invalidCount,
				warnings: warningCount,
			});

			return prev;
		});
	}, []);

	/**
	 * Remove a lead from staging
	 */
	const removeLead = useCallback((rowNumber: number) => {
		setStagedLeads((prev) => {
			const filtered = prev.filter((l) => l.rowNumber !== rowNumber);

			const validCount = filtered.filter((l) => l.isValid).length;
			const invalidCount = filtered.filter((l) => !l.isValid).length;
			const warningCount = filtered.filter(
				(l) => l.isValid && l.validationErrors.some((e) => e.severity === "warning")
			).length;

			setSummary({
				total: filtered.length,
				valid: validCount,
				invalid: invalidCount,
				warnings: warningCount,
			});

			return filtered;
		});
	}, []);

	/**
	 * Save staged leads to database
	 */
	const saveToStaging = useCallback(async (overrideBatchId?: string, overrideLeads?: StagedLead[]): Promise<boolean> => {
		const effectiveBatchId = overrideBatchId || batchId;
		const effectiveLeads = overrideLeads || stagedLeads;
		if (!effectiveBatchId || effectiveLeads.length === 0) return false;

		setIsUploading(true);
		setError(null);

		try {
			const leadsToSave: StagedLeadCreateInput[] = effectiveLeads.map((lead) => ({
				batchId: lead.batchId,
				rowNumber: lead.rowNumber,
				fullName: lead.fullName,
				email: lead.email,
				companyName: lead.companyName,
				phoneNumber: lead.phoneNumber,
				leadType: lead.leadType,
				validationErrors: lead.validationErrors,
				isValid: lead.isValid,
			}));

			const execution = await functions.createExecution({
				functionId: "save-staged-leads",
				body: JSON.stringify({ batchId: effectiveBatchId, leads: leadsToSave }),
				async: false,
			});

			// Check execution status
			if (execution.status === "failed") {
				throw new Error("Server function failed to execute");
			}

			// Check response status code
			if (execution.responseStatusCode >= 400) {
				let errorMessage = "Failed to save staged leads";
				try {
					const errorData = JSON.parse(execution.responseBody || "{}");
					errorMessage = errorData.message || errorMessage;
				} catch {
					// Use default error message if parsing fails
				}
				throw new Error(errorMessage);
			}

			// Parse and validate success response
			const response = JSON.parse(execution.responseBody || "{}");
			if (!response.success) {
				throw new Error(response.message || "Failed to save staged leads");
			}

			return true;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save staged leads");
			return false;
		} finally {
			setIsUploading(false);
		}
	}, [batchId, stagedLeads]);

	/**
	 * Reset state
	 */
	const reset = useCallback(() => {
		setStagedLeads([]);
		setSummary(null);
		setBatchId(null);
		setError(null);
		setIsLoading(false);
		setIsUploading(false);
	}, []);

	return {
		isLoading,
		isUploading,
		stagedLeads,
		summary,
		batchId,
		error,
		parseFile,
		updateLead,
		removeLead,
		saveToStaging,
		reset,
	};
}
