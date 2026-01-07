import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ExecutionMethod, type Models } from "appwrite";

import { AlertCircle, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { functions } from "@/lib/appwrite";
import { stagedLeadsKeys } from "@/lib/query-keys";
import { useExcelImport } from "../hooks/use-excel-import";

interface ExcelImportDialogProps {
	onImportSuccess?: () => void;
}

/**
 * Lightweight Excel/CSV import dialog - uploads and redirects to staging page
 */
export function ExcelImportDialog({ onImportSuccess }: ExcelImportDialogProps) {
	const [open, setOpen] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { isLoading, isUploading, error, parseFile, saveToStaging, reset } = useExcelImport();

	const processFile = async (file: File) => {
		// Check file type
		const validTypes = [
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-excel",
			"text/csv",
		];
		const isValid =
			validTypes.includes(file.type) || file.name.endsWith(".xlsx") || file.name.endsWith(".csv");

		if (!isValid) {
			toast.error("Please upload an Excel (.xlsx) or CSV file");
			return;
		}

		// Parse and immediately save to staging
		// parseFile returns the parsed data so we can pass it directly to saveToStaging
		// This avoids React state timing issues where state isn't updated yet
		const parsedData = await parseFile(file);
		if (!parsedData) return;

		const success = await saveToStaging(parsedData.batchId, parsedData.leads);

		if (success) {
			// Invalidate cache to ensure fresh data is fetched
			await queryClient.invalidateQueries({ queryKey: stagedLeadsKeys.all });

			toast.success("Leads imported to staging", {
				description: "Review and approve your leads on the staging page.",
			});
			setOpen(false);
			reset();
			onImportSuccess?.();
			navigate({ to: "/leads/staging" });
		} else {
			// Show toast error - the error state is already set by saveToStaging
			toast.error("Failed to save leads to staging", {
				description: "Check the dialog for details.",
			});
		}
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		await processFile(file);
		// Reset file input
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (!file) return;
		await processFile(file);
	};

	const handleDownloadTemplate = async () => {
		setIsDownloading(true);
		try {
			const execution = await functions.createExecution({
				functionId: "export-leads",
				body: JSON.stringify({ template: true }),
				async: false,
				method: ExecutionMethod.POST,
			});

			const response = parseExecutionResponse(execution);

			// Decode base64 and trigger download
			const byteCharacters = atob(response.data);
			const byteNumbers = new Array(byteCharacters.length);
			for (let i = 0; i < byteCharacters.length; i++) {
				byteNumbers[i] = byteCharacters.charCodeAt(i);
			}
			const byteArray = new Uint8Array(byteNumbers);
			const blob = new Blob([byteArray], {
				type:
					response.contentType ||
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			});

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = response.filename || "leads-import-template.xlsx";
			a.click();
			URL.revokeObjectURL(url);

			toast.success("Template downloaded");
		} catch (err) {
			console.error("Download error:", err);
			toast.error(err instanceof Error ? err.message : "Failed to download template");
		} finally {
			setIsDownloading(false);
		}
	};

	const handleClose = () => {
		setOpen(false);
		reset();
	};

	const isProcessing = isLoading || isUploading;

	return (
		<Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					className="gap-2 bg-card border-dashed border-2 hover:border-solid hover:border-primary/50 transition-all"
				>
					<FileSpreadsheet className="h-4 w-4" />
					Import Leads
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<FileSpreadsheet className="h-5 w-5 text-primary" />
						Import Leads from Excel
					</DialogTitle>
					<DialogDescription>
						Upload your Excel or CSV file. Leads will be saved to staging for review.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center justify-center py-8 gap-6">
					{/* Upload Zone */}
					<Button
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						variant="outline"
						disabled={isProcessing}
						className={`w-full h-auto flex-col border-2 border-dashed rounded-xl p-12 text-center transition-colors group ${isDragging
							? "border-primary bg-primary/10"
							: "border-muted-foreground/25 hover:border-primary/50 hover:bg-transparent"
							}`}
						onClick={() => fileInputRef.current?.click()}
					>
						{isProcessing ? (
							<>
								<Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
								<p className="text-lg font-medium mb-1">
									{isLoading ? "Parsing file..." : "Saving to staging..."}
								</p>
							</>
						) : (
							<>
								<Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
								<p className="text-lg font-medium mb-1">Drop your file here</p>
								<p className="text-sm text-muted-foreground font-normal">or click to browse</p>
								<p className="text-xs text-muted-foreground mt-3 font-normal">
									Supports .xlsx and .csv files
								</p>
							</>
						)}
					</Button>

					<input
						type="file"
						accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
						className="hidden"
						ref={fileInputRef}
						onChange={handleFileChange}
						disabled={isProcessing}
					/>

					{/* Template Download */}
					<Button
						variant="ghost"
						size="sm"
						className="gap-2"
						onClick={handleDownloadTemplate}
						disabled={isDownloading || isProcessing}
					>
						{isDownloading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Download className="h-4 w-4" />
						)}
						{isDownloading ? "Downloading..." : "Download Template"}
					</Button>

					{error && (
						<div className="flex items-center gap-2 text-destructive text-sm">
							<AlertCircle className="h-4 w-4" />
							{error}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function parseExecutionResponse(execution: Models.Execution) {
	validateExecutionStatus(execution);
	validateResponseError(execution);
	return parseResponseBody(execution);
}

function validateExecutionStatus(execution: Models.Execution) {
	if (execution.status === "failed") {
		console.error("Function execution failed", execution);
		throw new Error("Server function failed to execute. Please try again later.");
	}
}

function validateResponseError(execution: Models.Execution) {
	if (execution.responseStatusCode >= 400) {
		console.error("Template download failed", execution);
		if (!execution.responseBody || execution.responseBody.trim() === "") {
			throw new Error("Server returned an error with no details");
		}

		try {
			const errorData = JSON.parse(execution.responseBody);
			throw new Error(errorData.message || "Server returned error");
		} catch (e) {
			if (e instanceof Error && !e.message.includes("JSON")) {
				throw e;
			}
			throw new Error(`Server error: ${execution.responseBody.substring(0, 100)}`);
		}
	}
}

function parseResponseBody(execution: Models.Execution) {
	if (!execution.responseBody || execution.responseBody.trim() === "") {
		throw new Error("Server returned an empty response");
	}

	try {
		const response = JSON.parse(execution.responseBody);
		if (!response.data) throw new Error("No data received from server");
		return response;
	} catch (e) {
		if (e instanceof Error && e.message === "No data received from server") throw e;
		console.error("Failed to parse response", execution.responseBody);
		throw new Error("Invalid server response format");
	}
}
