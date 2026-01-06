import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { FieldValidationIssue, StagedLead } from "@shared/types/staged-lead.types";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Query } from "appwrite";
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	useApproveStagedLeads,
	useDeleteStagedBatch,
	useDeleteStagedLead,
	useStagedLeads,
	useUpdateStagedLead,
} from "@/features/leads/hooks/use-staged-leads";
import { databases } from "@/lib/appwrite";
import { stagedLeadsKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/leads/staging")({
	component: StagedLeadsPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: stagedLeadsKeys.list(undefined),
			queryFn: async () => {
				const response = await databases.listDocuments(DATABASE_ID, CollectionId.STAGED_LEADS, [
					Query.orderDesc("$createdAt"),
					Query.limit(500),
				]);
				return response.documents.map((doc) => ({
					...doc,
					validationErrors:
						typeof doc.validationErrors === "string"
							? JSON.parse(doc.validationErrors)
							: doc.validationErrors || [],
				})) as unknown as StagedLead[];
			},
		});
	},
});

function StagedLeadsPage() {
	const { data: stagedLeads = [], isLoading, error } = useStagedLeads();
	const updateLead = useUpdateStagedLead();
	const deleteLead = useDeleteStagedLead();
	const approveLeads = useApproveStagedLeads();
	const deleteBatch = useDeleteStagedBatch();

	// Calculate summary
	const summary = {
		total: stagedLeads.length,
		valid: stagedLeads.filter((l) => l.isValid).length,
		invalid: stagedLeads.filter((l) => !l.isValid).length,
		warnings: stagedLeads.filter(
			(l) => l.isValid && l.validationErrors.some((e) => e.severity === "warning")
		).length,
	};

	// Get unique batch ID (assuming single batch for now)
	const batchId = stagedLeads[0]?.batchId;

	const handleApproveAll = () => {
		if (!batchId) return;
		approveLeads.mutate({ batchId });
	};

	const handleDeleteBatch = () => {
		if (!batchId) return;
		deleteBatch.mutate(batchId);
	};

	if (isLoading) {
		return (
			<div className="p-8 flex items-center justify-center min-h-[400px]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-8">
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="h-5 w-5" />
					<span>Failed to load staged leads: {error.message}</span>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8 space-y-6 max-w-[1600px] mx-auto">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Link to="/leads">
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold tracking-tight mb-1">Staged Leads</h1>
						<p className="text-muted-foreground">
							Review and approve imported leads before adding to your database.
						</p>
					</div>
				</div>
				{stagedLeads.length > 0 && (
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={handleDeleteBatch}
							disabled={deleteBatch.isPending}
							className="gap-2 text-destructive hover:text-destructive"
						>
							{deleteBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
							<Trash2 className="h-4 w-4" />
							Discard All
						</Button>
						<Button
							onClick={handleApproveAll}
							disabled={approveLeads.isPending || summary.valid === 0}
							className="gap-2"
						>
							{approveLeads.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
							<CheckCircle2 className="h-4 w-4" />
							Approve Valid ({summary.valid})
						</Button>
					</div>
				)}
			</div>

			{/* Summary Bar */}
			{stagedLeads.length > 0 && (
				<div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
					<Badge variant="outline" className="gap-1.5">
						Total: {summary.total}
					</Badge>
					<Badge variant="outline" className="gap-1.5 border-emerald-500/50 text-emerald-600">
						<CheckCircle2 className="h-3 w-3" />
						Valid: {summary.valid}
					</Badge>
					{summary.invalid > 0 && (
						<Badge variant="outline" className="gap-1.5 border-destructive/50 text-destructive">
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

			{/* Empty State */}
			{stagedLeads.length === 0 && (
				<div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-500">
					<CheckCircle2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
					<h2 className="text-xl font-semibold mb-2">No Staged Leads</h2>
					<p className="text-muted-foreground mb-6">
						Import leads from an Excel file to review them here.
					</p>
					<Link to="/leads">
						<Button>Go to Lead Management</Button>
					</Link>
				</div>
			)}

			{/* Table */}
			{stagedLeads.length > 0 && (
				<ScrollArea className="border rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
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
							{stagedLeads.map((lead, index) => (
								<StagedLeadTableRow
									key={lead.$id}
									lead={lead}
									index={index}
									onUpdate={(field, value) =>
										updateLead.mutate({
											documentId: lead.$id as string,
											field,
											value,
										})
									}
									onDelete={() => deleteLead.mutate(lead.$id as string)}
									isUpdating={updateLead.isPending}
								/>
							))}
						</TableBody>
					</Table>
				</ScrollArea>
			)}
		</div>
	);
}

interface StagedLeadTableRowProps {
	lead: StagedLead;
	index: number;
	onUpdate: (field: "fullName" | "email" | "companyName", value: string) => void;
	onDelete: () => void;
	isUpdating: boolean;
}

function StagedLeadTableRow({ lead, index, onUpdate, onDelete }: StagedLeadTableRowProps) {
	const hasWarnings = lead.validationErrors.some((e) => e.severity === "warning");
	const nameErrors = lead.validationErrors.filter((e) => e.field === "fullName");
	const emailErrors = lead.validationErrors.filter((e) => e.field === "email");
	const companyErrors = lead.validationErrors.filter((e) => e.field === "companyName");

	const getValidationIcon = () => {
		if (!lead.isValid) return <AlertCircle className="h-4 w-4 text-destructive" />;
		if (hasWarnings) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
		return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
	};

	const getFieldClassName = (errors: FieldValidationIssue[]) => {
		if (errors.some((e) => e.severity === "error"))
			return "border-destructive focus:ring-destructive";
		if (errors.length > 0) return "border-amber-500 focus:ring-amber-500";
		return "";
	};

	// Staggered animation delay
	const animationDelay = `${Math.min(index * 30, 300)}ms`;

	return (
		<TableRow
			className={`
				${!lead.isValid ? "bg-destructive/5" : ""}
				animate-in fade-in slide-in-from-left-2 duration-300
			`}
			style={{ animationDelay }}
		>
			<TableCell className="text-muted-foreground text-xs">{lead.rowNumber}</TableCell>
			<TableCell>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="cursor-help">{getValidationIcon()}</div>
					</TooltipTrigger>
					<TooltipContent side="right" className="max-w-xs">
						{lead.validationErrors.length === 0 ? (
							"All validations passed"
						) : (
							<ul className="text-xs space-y-1">
								{lead.validationErrors.map((err, idx) => (
									<li key={idx} className="flex items-center gap-1">
										{err.severity === "error" ? (
											<AlertCircle className="h-3 w-3 text-destructive shrink-0" />
										) : (
											<AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
										)}
										<span>
											<strong>{err.field}:</strong> {err.message}
										</span>
									</li>
								))}
							</ul>
						)}
					</TooltipContent>
				</Tooltip>
			</TableCell>
			<TableCell>
				<EditableField
					value={lead.fullName}
					errors={nameErrors}
					onSave={(value) => onUpdate("fullName", value)}
					className={getFieldClassName(nameErrors)}
				/>
			</TableCell>
			<TableCell>
				<EditableField
					value={lead.email}
					errors={emailErrors}
					onSave={(value) => onUpdate("email", value)}
					className={getFieldClassName(emailErrors)}
				/>
			</TableCell>
			<TableCell>
				<EditableField
					value={lead.companyName}
					errors={companyErrors}
					onSave={(value) => onUpdate("companyName", value)}
					className={getFieldClassName(companyErrors)}
				/>
			</TableCell>
			<TableCell>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
					onClick={onDelete}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}

interface EditableFieldProps {
	value: string;
	errors: FieldValidationIssue[];
	onSave: (value: string) => void;
	className?: string;
}

function EditableField({ value, errors, onSave, className = "" }: EditableFieldProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);

	const handleBlur = () => {
		setIsEditing(false);
		if (editValue !== value) {
			onSave(editValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleBlur();
		} else if (e.key === "Escape") {
			setEditValue(value);
			setIsEditing(false);
		}
	};

	// Show the field error inline when not editing
	const hasError = errors.some((e) => e.severity === "error");
	const errorMessage = errors.find((e) => e.severity === "error")?.message;

	return (
		<div className="space-y-1">
			<Input
				value={isEditing ? editValue : value}
				onChange={(e) => setEditValue(e.target.value)}
				onFocus={() => {
					setIsEditing(true);
					setEditValue(value);
				}}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={`h-8 transition-all ${className} ${
					hasError && !isEditing ? "animate-in shake duration-300" : ""
				}`}
			/>
			{hasError && !isEditing && (
				<p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
