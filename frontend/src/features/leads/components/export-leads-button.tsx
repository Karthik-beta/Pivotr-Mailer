import { ExecutionMethod } from "appwrite";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { functions } from "@/lib/appwrite";

interface ExportLeadsButtonProps {
	campaignId?: string;
}

/**
 * Export leads to Excel button with format options
 */
export function ExportLeadsButton({ campaignId }: ExportLeadsButtonProps) {
	const [isExporting, setIsExporting] = useState(false);

	const handleExport = async (status?: string) => {
		setIsExporting(true);

		try {
			const result = await functions.createExecution({
				functionId: "export-leads",
				body: JSON.stringify({ campaignId, status, format: "xlsx" }),
				async: false,
				method: ExecutionMethod.POST,
			});

			const response = JSON.parse(result.responseBody);

			if (!response.data) {
				throw new Error("No data received");
			}

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
			a.download = response.filename || `leads-export-${Date.now()}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);

			toast.success("Leads exported successfully");
		} catch {
			toast.error("Failed to export leads");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2 bg-card" disabled={isExporting}>
					{isExporting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Download className="h-4 w-4" />
					)}
					Export
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => handleExport()}>
					<FileSpreadsheet className="h-4 w-4 mr-2" />
					Export All Leads
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => handleExport("PENDING_IMPORT")}>
					<FileSpreadsheet className="h-4 w-4 mr-2" />
					Export Pending Only
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => handleExport("SENT")}>
					<FileSpreadsheet className="h-4 w-4 mr-2" />
					Export Sent Only
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
