import type { StagedLead } from "@shared/types/staged-lead.types";
import { AlertCircle, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StagedLeadRowProps {
	lead: StagedLead;
	updateLead: (rowNumber: number, field: keyof StagedLead, value: string) => void;
	removeLead: (rowNumber: number) => void;
}

export function StagedLeadRow({ lead, updateLead, removeLead }: StagedLeadRowProps) {
	const hasWarnings = lead.validationErrors.some((e) => e.severity === "warning");
	const nameErrors = lead.validationErrors.filter((e) => e.field === "fullName");
	const emailErrors = lead.validationErrors.filter((e) => e.field === "email");
	const companyErrors = lead.validationErrors.filter((e) => e.field === "companyName");

	const getValidationIcon = (isValid: boolean, hasWarnings: boolean) => {
		if (!isValid) return <AlertCircle className="h-4 w-4 text-destructive" />;
		if (hasWarnings) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
		return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
	};

	return (
		<TableRow className={!lead.isValid ? "bg-destructive/5" : ""}>
			<TableCell className="text-muted-foreground text-xs">{lead.rowNumber}</TableCell>
			<TableCell>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="cursor-help">{getValidationIcon(lead.isValid, hasWarnings)}</div>
					</TooltipTrigger>
					<TooltipContent side="right" className="max-w-xs">
						{lead.validationErrors.length === 0 ? (
							"All validations passed"
						) : (
							<ul className="text-xs space-y-1">
								{lead.validationErrors.map((err, idx) => (
									<li key={idx} className="flex items-center gap-1">
										{err.severity === "error" ? (
											<AlertCircle className="h-3 w-3 text-destructive" />
										) : (
											<AlertTriangle className="h-3 w-3 text-amber-500" />
										)}
										{err.message}
									</li>
								))}
							</ul>
						)}
					</TooltipContent>
				</Tooltip>
			</TableCell>
			<TableCell>
				<Input
					value={lead.fullName}
					onChange={(e) => updateLead(lead.rowNumber, "fullName", e.target.value)}
					className={`h-8 ${nameErrors.some((e) => e.severity === "error") ? "border-destructive" : nameErrors.length > 0 ? "border-amber-500" : ""}`}
				/>
			</TableCell>
			<TableCell>
				<Input
					value={lead.email}
					onChange={(e) => updateLead(lead.rowNumber, "email", e.target.value)}
					className={`h-8 ${emailErrors.some((e) => e.severity === "error") ? "border-destructive" : emailErrors.length > 0 ? "border-amber-500" : ""}`}
				/>
			</TableCell>
			<TableCell>
				<Input
					value={lead.companyName}
					onChange={(e) => updateLead(lead.rowNumber, "companyName", e.target.value)}
					className={`h-8 ${companyErrors.some((e) => e.severity === "error") ? "border-destructive" : companyErrors.length > 0 ? "border-amber-500" : ""}`}
				/>
			</TableCell>
			<TableCell>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-destructive"
					onClick={() => removeLead(lead.rowNumber)}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}
