import { useNavigate } from "@tanstack/react-router";
import { ExecutionMethod, type Models } from "appwrite";

import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Loader2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { functions } from "@/lib/appwrite";
import { useExcelImport } from "../hooks/use-excel-import";
import { StagedLeadRow } from "./staged-lead-row";

interface ExcelImportDialogProps {
	onImportSuccess?: () => void;
}

/**
 * Excel/CSV import dialog with staging workflow and real-time validation
 */
export function ExcelImportDialog({ onImportSuccess }: ExcelImportDialogProps) {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<"upload" | "review">("upload");
	const [isDownloading, setIsDownloading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const navigate = useNavigate();

	const {
		isLoading,
		isUploading,
		stagedLeads,
		summary,
		error,
		parseFile,
		updateLead,
		removeLead,
		saveToStaging,
		reset,
	} = useExcelImport();

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

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

		await parseFile(file);
		setStep("review");

		// Reset file input
		if (fileInputRef.current) fileInputRef.current.value = "";
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

	const handleSaveAndReview = async () => {
		const success = await saveToStaging();
		if (success) {
			toast.success("Leads saved to staging");
			setOpen(false);
			reset();
			setStep("upload");
			onImportSuccess?.();
			// Navigate to staging page
			navigate({ to: "/leads/staging" });
		}
	};

	const handleClose = () => {
		setOpen(false);
		reset();
		setStep("upload");
	};

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

			<DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
				<DialogHeader className="shrink-0">
					<DialogTitle className="flex items-center gap-2 text-xl">
						<FileSpreadsheet className="h-5 w-5 text-primary" />
						{step === "upload" ? "Import Leads from Excel" : "Review & Validate Leads"}
					</DialogTitle>
				</DialogHeader>

				{step === "upload" && (
					<div className="flex-1 flex flex-col items-center justify-center py-12 gap-6">
						{/* Upload Zone */}
						<Button
							variant="outline"
							className="w-full max-w-md h-auto flex-col border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center hover:border-primary/50 hover:bg-transparent transition-colors group"
							onClick={() => fileInputRef.current?.click()}
						>
							<Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
							<p className="text-lg font-medium mb-1">Drop your file here</p>
							<p className="text-sm text-muted-foreground font-normal">or click to browse</p>
							<p className="text-xs text-muted-foreground mt-3 font-normal">
								Supports .xlsx and .csv files
							</p>
						</Button>

						<input
							type="file"
							accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
							className="hidden"
							ref={fileInputRef}
							onChange={handleFileChange}
						/>

						{/* Template Download */}
						<Button
							variant="ghost"
							size="sm"
							className="gap-2"
							onClick={handleDownloadTemplate}
							disabled={isDownloading}
						>
							{isDownloading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Download className="h-4 w-4" />
							)}
							{isDownloading ? "Downloading..." : "Download Template"}
						</Button>

						{isLoading && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								Parsing file...
							</div>
						)}

						{error && (
							<div className="flex items-center gap-2 text-destructive">
								<AlertCircle className="h-4 w-4" />
								{error}
							</div>
						)}
					</div>
				)}

				{step === "review" && (
					<>
						{/* Summary Bar */}
						{summary && (
							<div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-lg shrink-0">
								<Badge variant="outline" className="gap-1.5">
									Total: {summary.total}
								</Badge>
								<Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-emerald-600">
									<CheckCircle2 className="h-3 w-3" />
									Valid: {summary.valid}
								</Badge>
								{summary.invalid > 0 && (
									<Badge
										variant="outline"
										className="gap-1.5 border-destructive/50 text-destructive"
									>
										<AlertCircle className="h-3 w-3" />
										Invalid: {summary.invalid}
									</Badge>
								)}
								{summary.warnings > 0 && (
									<Badge variant="outline" className="gap-1.5 border-amber-500/50 text-amber-600">
										<AlertTriangle className="h-3 w-3" />
										Warnings: {summary.warnings}
									</Badge>
								)}
							</div>
						)}

						{/* Table */}
						<ScrollArea className="flex-1 min-h-0 border rounded-lg">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/30">
										<TableHead className="w-12">Row</TableHead>
										<TableHead className="w-12">Status</TableHead>
										<TableHead>Full Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Company Name</TableHead>
										<TableHead className="w-12" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{stagedLeads.map((lead) => (
										<StagedLeadRow
											key={lead.rowNumber}
											lead={lead}
											updateLead={updateLead}
											removeLead={removeLead}
										/>
									))}
								</TableBody>
							</Table>
						</ScrollArea>

						{/* Actions */}
						<div className="flex items-center justify-between pt-4 border-t shrink-0">
							<Button
								variant="outline"
								onClick={() => {
									reset();
									setStep("upload");
								}}
							>
								Upload Different File
							</Button>

							<div className="flex gap-2">
								<Button variant="ghost" onClick={handleClose}>
									Cancel
								</Button>
								<Button
									onClick={handleSaveAndReview}
									disabled={isUploading || stagedLeads.length === 0}
									className="gap-2"
								>
									{isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
									Save & Review
								</Button>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function parseExecutionResponse(execution: Models.Execution) {
	// Handle function execution failure (crashed before returning a response)
	if (execution.status === "failed") {
		console.error("Function execution failed", execution);
		throw new Error("Server function failed to execute. Please try again later.");
	}

	if (execution.responseStatusCode >= 400) {
		console.error("Template download failed", execution);
		// Guard against empty response body
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

	// Guard against empty response body for success responses
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
