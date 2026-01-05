import type { StagedLead, StagedLeadCreateInput } from "@shared/types/staged-lead.types";
import { validateStagedLead } from "@shared/validation/lead-validator";
import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { functions } from "@/lib/appwrite";

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
	parseFile: (file: File) => Promise<void>;
	updateLead: (rowNumber: number, field: keyof StagedLead, value: string) => void;
	removeLead: (rowNumber: number) => void;
	saveToStaging: () => Promise<boolean>;
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
	const parseFile = useCallback(async (file: File) => {
		setIsLoading(true);
		setError(null);

		try {
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data, { type: "array" });

			// Get first sheet
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];

			// Convert to JSON array
			const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

			if (rows.length === 0) {
				throw new Error("No data found in file");
			}

			// Generate batch ID
			const newBatchId = crypto.randomUUID();
			setBatchId(newBatchId);

			// Map and validate each row
			const leads: StagedLead[] = rows.map((row, index) => {
				// Normalize column names (handle various formats)
				const fullName = row["Full Name"] || row.fullName || row.Name || row.name || "";
				const email = row.Email || row.email || row["E-mail"] || "";
				const companyName =
					row["Company Name"] || row.companyName || row.Company || row.company || "";
				const phoneNumber =
					row["Phone Number"] || row.phoneNumber || row.Phone || row.phone || row.Mobile || "";
				const leadType = row["Lead Type"] || row.leadType || row.Type || row.type || "";

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
					rowNumber: index + 2, // Excel rows are 1-indexed, row 1 is header
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
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to parse file");
			setStagedLeads([]);
			setSummary(null);
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
	const saveToStaging = useCallback(async (): Promise<boolean> => {
		if (!batchId || stagedLeads.length === 0) return false;

		setIsUploading(true);
		setError(null);

		try {
			const leadsToSave: StagedLeadCreateInput[] = stagedLeads.map((lead) => ({
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

			await functions.createExecution(
				"save-staged-leads",
				JSON.stringify({ batchId, leads: leadsToSave }),
				false
			);

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
