import { FieldValidationIssue, StagedLead } from "@shared/types/staged-lead.types";
import { validateCompanyName, validateEmail, validateName } from "@shared/validation/lead-validator";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	useApproveStagedLeads,
	useDeleteStagedBatch,
	useDeleteStagedLead,
	useStagedLeads,
	useUpdateStagedLead,
} from "@/features/leads/hooks/use-staged-leads";

export const Route = createFileRoute("/leads/staging")({
	component: StagedLeadsPage,
	// Loader commented out as prefetching for infinite query requires different handling
	// and to avoid type mismatches during transition
});

function StagedLeadsPage() {
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		error,
	} = useStagedLeads();

	const updateLead = useUpdateStagedLead();
	const deleteLead = useDeleteStagedLead();
	const approveLeads = useApproveStagedLeads();
	const deleteBatch = useDeleteStagedBatch();

	// Flatten data from pages
	const stagedLeads = useMemo(
		() => data?.pages.flatMap((page) => page) ?? [],
		[data]
	);

	// Virtualization setup
	const parentRef = useRef<HTMLDivElement>(null);

	const rowVirtualizer = useVirtualizer({
		count: stagedLeads.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 65, // Approximate row height
		overscan: 10,
	});

	// Infinite scroll trigger
	useEffect(() => {
		const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

		if (!lastItem) {
			return;
		}

		if (
			lastItem.index >= stagedLeads.length - 1 &&
			hasNextPage &&
			!isFetchingNextPage
		) {
			console.log("Fetching next page...");
			fetchNextPage();
		}
	}, [
		hasNextPage,
		fetchNextPage,
		stagedLeads.length,
		isFetchingNextPage,
		rowVirtualizer.getVirtualItems(),
	]);

	// Calculate summary
	const summary = useMemo(() => {
		return {
			total: stagedLeads.length,
			valid: stagedLeads.filter((l) => l.isValid).length,
			invalid: stagedLeads.filter((l) => !l.isValid).length,
			warnings: stagedLeads.filter(
				(l) => l.isValid && l.validationErrors.some((e) => e.severity === "warning")
			).length,
		};
	}, [stagedLeads]);

	// Get unique batch ID
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
			<div className="h-full flex items-center justify-center min-h-[400px]">
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

	// Grid layout definition
	const gridTemplate = "grid grid-cols-[3rem_3rem_1fr_1fr_1fr_3rem] gap-4 items-center px-4";

	return (
		<div className="h-[calc(100vh-4rem)] flex flex-col p-6 space-y-4 max-w-[1800px] mx-auto overflow-hidden">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
				<div className="flex items-center gap-4">
					<Link to="/leads">
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<div>
						<h1 className="text-3xl font-bold tracking-tight mb-1">Staged Leads</h1>
						<p className="text-muted-foreground">
							Review and approve imported leads.
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
							Approve Valid
						</Button>
					</div>
				)}
			</div>

			{/* Summary Bar */}
			{stagedLeads.length > 0 && (
				<div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-lg shrink-0">
					<Badge variant="outline" className="gap-1.5">
						Loaded: {summary.total}
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
				<div className="flex flex-col items-center justify-center flex-1 text-center animate-in fade-in duration-500">
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

			{/* Virtualized Table Container */}
			{stagedLeads.length > 0 && (
				<div className="flex-1 border rounded-lg overflow-hidden flex flex-col relative bg-background">
					{/* Fixed Header */}
					<div className={`bg-muted/30 border-b z-10 shrink-0 h-10 ${gridTemplate} text-sm font-medium text-muted-foreground`}>
						<div>Row</div>
						<div>Status</div>
						<div>Full Name</div>
						<div>Email</div>
						<div>Company Name</div>
						<div />
					</div>

					{/* Virtualized List */}
					<div ref={parentRef} className="flex-1 overflow-auto">
						<div
							style={{
								height: `${rowVirtualizer.getTotalSize()}px`,
								width: '100%',
								position: 'relative',
							}}
						>
							{rowVirtualizer.getVirtualItems().map((virtualRow) => {
								const lead = stagedLeads[virtualRow.index];
								if (!lead) return null;

								return (
									<div
										key={lead.$id}
										data-index={virtualRow.index}
										ref={rowVirtualizer.measureElement}
										className={`absolute top-0 left-0 w-full border-b transition-colors hover:bg-muted/50 ${!lead.isValid ? "bg-destructive/5" : ""}`}
										style={{
											transform: `translateY(${virtualRow.start}px)`,
										}}
									>
										<StagedLeadTableRow
											lead={lead}
											onUpdate={(field, value) =>
												updateLead.mutate({
													documentId: lead.$id as string,
													field,
													value,
												})
											}
											onDelete={() => deleteLead.mutate(lead.$id as string)}
											isUpdating={updateLead.isPending}
											gridClass={gridTemplate}
										/>
									</div>
								);
							})}
						</div>

						{isFetchingNextPage && (
							<div className="py-2 flex justify-center w-full">
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

interface StagedLeadTableRowProps {
	lead: StagedLead;
	onUpdate: (field: "fullName" | "email" | "companyName", value: string) => void;
	onDelete: () => void;
	isUpdating: boolean;
	gridClass: string;
}

function StagedLeadTableRow({ lead, onUpdate, onDelete, gridClass }: StagedLeadTableRowProps) {
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

	return (
		<div className={`${gridClass} py-2`}>
			<div className="text-muted-foreground text-xs">{lead.rowNumber}</div>
			<div className="flex items-center">
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="cursor-help">{getValidationIcon()}</div>
					</TooltipTrigger>
					<TooltipContent side="right" className="max-w-xs z-50">
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
			</div>
			<div>
				<EditableField
					value={lead.fullName}
					errors={nameErrors}
					onSave={(value) => onUpdate("fullName", value)}
					className={getFieldClassName(nameErrors)}
					validator={validateName}
				/>
			</div>
			<div>
				<EditableField
					value={lead.email}
					errors={emailErrors}
					onSave={(value) => onUpdate("email", value)}
					className={getFieldClassName(emailErrors)}
					validator={validateEmail}
				/>
			</div>
			<div>
				<EditableField
					value={lead.companyName}
					errors={companyErrors}
					onSave={(value) => onUpdate("companyName", value)}
					className={getFieldClassName(companyErrors)}
					validator={validateCompanyName}
				/>
			</div>
			<div className="flex justify-end">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
					onClick={onDelete}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

interface EditableFieldProps {
	value: string;
	errors: FieldValidationIssue[];
	onSave: (value: string) => void;
	className?: string;
	validator?: (value: string) => FieldValidationIssue[];
}

function EditableField({ value, errors, onSave, className = "", validator }: EditableFieldProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [localValue, setLocalValue] = useState(value);

	// Sync local value when prop value changes (e.g. server update)
	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleBlur = () => {
		setIsEditing(false);
		if (localValue !== value) {
			onSave(localValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleBlur();
			e.currentTarget.blur();
		} else if (e.key === "Escape") {
			setLocalValue(value);
			setIsEditing(false);
			e.currentTarget.blur();
		}
	};

	// Determine if the value is dirty (user changed it but server update hasn't reflected yet)
	const isDirty = localValue !== value;

	// Use client-side validation if dirty (real-time feedback), otherwise fallback to server validation
	const clientErrors = isDirty && validator ? validator(localValue) : [];
	const visibleErrors = isDirty ? clientErrors : errors;

	const hasError = visibleErrors.some((e) => e.severity === "error");
	const errorMessage = visibleErrors.find((e) => e.severity === "error")?.message;

	return (
		<div className="space-y-1">
			<Input
				value={localValue}
				onChange={(e) => setLocalValue(e.target.value)}
				onFocus={() => setIsEditing(true)}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={`h-8 transition-all ${className} ${hasError && !isEditing ? "animate-in shake duration-300" : ""
					}`}
			/>
			{hasError && (
				<p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
