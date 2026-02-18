/**
 * Staging Leads Data Table Component
 *
 * Premium data table for staging leads with inline validation display and editing.
 * Shows validation errors/warnings prominently to allow user correction before approval.
 */

import { rankItem } from "@tanstack/match-sorter-utils";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type ExpandedState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	AlertCircle,
	AlertTriangle,
	ArrowUpDown,
	Building2,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronRight as ChevronRightIcon,
	ChevronsLeft,
	ChevronsRight,
	Mail,
	Pencil,
	Phone,
	RefreshCw,
	Search,
	Trash2,
	User,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { StagedLead, StagingStatus } from "../types";
import { StagingStatusBadge, ValidationConfidenceBadge } from "./LeadStatusBadge";

// Define fuzzy filter function
const fuzzyFilter: FilterFn<StagedLead> = (row, columnId, value, addMeta) => {
	const itemRank = rankItem(row.getValue(columnId), value);
	addMeta({ itemRank });
	return itemRank.passed;
};

interface StagingLeadsDataTableProps {
	data: StagedLead[];
	isLoading?: boolean;
	error?: Error | null;
	onRetry?: () => void;
	onApprove?: (id: string) => void;
	onDelete?: (id: string) => void;
	onUpdate?: (id: string, data: Partial<StagedLead>) => void;
	onSelectionChange?: (selectedIds: string[]) => void;
	isApproving?: boolean;
	isDeleting?: boolean;
	// URL-driven state
	statusFilter?: StagingStatus | "all";
	onStatusFilterChange?: (status: string) => void;
	pageSize?: number;
	onPageSizeChange?: (size: number) => void;
	pageIndex?: number;
	onPageIndexChange?: (index: number) => void;
}

export function StagingLeadsDataTable({
	data,
	isLoading,
	error,
	onRetry,
	onApprove,
	onDelete,
	onUpdate,
	onSelectionChange,
	isApproving,
	isDeleting,
	statusFilter = "all",
	onStatusFilterChange,
	pageSize = 10,
	onPageSizeChange,
	pageIndex = 0,
	onPageIndexChange,
}: StagingLeadsDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [expanded, setExpanded] = useState<ExpandedState>({});
	const [globalFilter, setGlobalFilter] = useState("");
	const [editingLead, setEditingLead] = useState<StagedLead | null>(null);

	// Sync status filter from URL to table column filter
	const effectiveColumnFilters = useMemo(() => {
		if (statusFilter && statusFilter !== "all") {
			return [
				...columnFilters.filter((f) => f.id !== "status"),
				{ id: "status", value: statusFilter },
			];
		}
		return columnFilters.filter((f) => f.id !== "status");
	}, [columnFilters, statusFilter]);

	// Derive pagination state from URL params
	const pagination = useMemo(
		() => ({
			pageIndex,
			pageSize,
		}),
		[pageIndex, pageSize]
	);
	const [editFormData, setEditFormData] = useState({
		fullName: "",
		email: "",
		companyName: "",
		phoneNumber: "",
	});

	const handleEditClick = useCallback((lead: StagedLead) => {
		setEditingLead(lead);
		setEditFormData({
			fullName: lead.fullName,
			email: lead.email,
			companyName: lead.companyName,
			phoneNumber: lead.phoneNumber || "",
		});
	}, []);

	const handleSaveEdit = () => {
		if (editingLead && onUpdate) {
			onUpdate(editingLead.id, editFormData);
			setEditingLead(null);
		}
	};

	const columns = useMemo<ColumnDef<StagedLead>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && "indeterminate")
						}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
						aria-label="Select all"
						className="translate-y-0.5"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
						className="translate-y-0.5"
						onClick={(e) => e.stopPropagation()}
					/>
				),
				enableSorting: false,
				enableHiding: false,
				size: 40,
			},
			{
				id: "expander",
				header: () => null,
				cell: ({ row }) => {
					const hasIssues =
						row.original.validationResult.errors.length > 0 ||
						row.original.validationResult.warnings.length > 0;
					return hasIssues ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={(e) => {
								e.stopPropagation();
								row.toggleExpanded();
							}}
						>
							{row.getIsExpanded() ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRightIcon className="h-4 w-4" />
							)}
						</Button>
					) : (
						<div className="h-6 w-6 flex items-center justify-center">
							<CheckCircle2 className="h-4 w-4 text-emerald-500" />
						</div>
					);
				},
				size: 40,
			},
			{
				accessorKey: "fullName",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2 -ml-2 hover:bg-accent"
					>
						<User className="mr-2 h-4 w-4 text-muted-foreground" />
						Name
						<ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
					</Button>
				),
				cell: ({ row }) => {
					const nameValidation = row.original.validationResult.nameValidation;
					const hasErrors = nameValidation.errors.length > 0;
					return (
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<span className={cn("font-medium", hasErrors ? "text-red-600" : "text-foreground")}>
									{row.getValue("fullName")}
								</span>
								{hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground">
									Parsed: {row.original.parsedFirstName}
								</span>
								<ValidationConfidenceBadge confidence={nameValidation.confidence} />
							</div>
						</div>
					);
				},
			},
			{
				accessorKey: "email",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2 -ml-2 hover:bg-accent"
					>
						<Mail className="mr-2 h-4 w-4 text-muted-foreground" />
						Email
						<ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
					</Button>
				),
				cell: ({ row }) => {
					const emailValidation = row.original.validationResult.emailValidation;
					const hasErrors = emailValidation.errors.length > 0;
					return (
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<span className={cn(hasErrors ? "text-red-600" : "text-foreground")}>
									{row.getValue("email")}
								</span>
								{hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
							</div>
							<div className="flex gap-1.5">
								{emailValidation.isCorporate && (
									<span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
										Corporate
									</span>
								)}
								{emailValidation.isDisposable && (
									<span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
										Disposable
									</span>
								)}
							</div>
						</div>
					);
				},
			},
			{
				accessorKey: "companyName",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2 -ml-2 hover:bg-accent"
					>
						<Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
						Company
						<ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
					</Button>
				),
				cell: ({ row }) => {
					const companyValidation = row.original.validationResult.companyValidation;
					const hasErrors = companyValidation.errors.length > 0;
					const hasWarnings = companyValidation.warnings.length > 0;
					return (
						<div className="flex items-center gap-2">
							<span
								className={cn(
									hasErrors ? "text-red-600" : hasWarnings ? "text-amber-600" : "text-foreground"
								)}
							>
								{row.getValue("companyName")}
							</span>
							{hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
							{!hasErrors && hasWarnings && <AlertTriangle className="h-4 w-4 text-amber-500" />}
						</div>
					);
				},
			},
			{
				accessorKey: "phoneNumber",
				header: () => (
					<div className="flex items-center gap-2">
						<Phone className="h-4 w-4 text-muted-foreground" />
						Phone
					</div>
				),
				cell: ({ row }) => {
					const phone = row.getValue("phoneNumber") as string | undefined;
					const phoneValidation = row.original.validationResult.phoneValidation;
					const hasErrors = phoneValidation?.errors && phoneValidation.errors.length > 0;
					return phone ? (
						<div className="flex items-center gap-2">
							<span className={cn(hasErrors ? "text-red-600" : "text-muted-foreground")}>
								{phone}
							</span>
							{hasErrors && <AlertCircle className="h-4 w-4 text-red-500" />}
						</div>
					) : (
						<span className="text-muted-foreground/50">—</span>
					);
				},
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => <StagingStatusBadge status={row.getValue("status") as StagingStatus} />,
				filterFn: (row, id, value) => {
					return value.includes(row.getValue(id));
				},
			},
			{
				id: "validation",
				header: "Issues",
				cell: ({ row }) => {
					const validation = row.original.validationResult;
					const errorCount = validation.errors.length;
					const warningCount = validation.warnings.length;

					if (errorCount === 0 && warningCount === 0) {
						return (
							<span className="flex items-center gap-1 text-emerald-600 text-sm">
								<CheckCircle2 className="h-4 w-4" />
								Valid
							</span>
						);
					}

					return (
						<div className="flex items-center gap-2">
							{errorCount > 0 && (
								<span className="flex items-center gap-1 text-red-600 text-sm">
									<AlertCircle className="h-4 w-4" />
									{errorCount}
								</span>
							)}
							{warningCount > 0 && (
								<span className="flex items-center gap-1 text-amber-600 text-sm">
									<AlertTriangle className="h-4 w-4" />
									{warningCount}
								</span>
							)}
						</div>
					);
				},
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => {
					const lead = row.original;
					const isValid = lead.validationResult.valid;
					const canApprove = lead.status === "PENDING_REVIEW" || lead.status === "VALIDATED";

					return (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={(e) => {
									e.stopPropagation();
									handleEditClick(lead);
								}}
							>
								<Pencil className="h-4 w-4" />
								<span className="sr-only">Edit</span>
							</Button>
							{canApprove && (
								<Button
									variant="ghost"
									size="sm"
									className={cn(
										"h-8 w-8 p-0",
										isValid
											? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
											: "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
									)}
									onClick={(e) => {
										e.stopPropagation();
										onApprove?.(lead.id);
									}}
									disabled={isApproving}
								>
									<Check className="h-4 w-4" />
									<span className="sr-only">Approve</span>
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
								onClick={(e) => {
									e.stopPropagation();
									onDelete?.(lead.id);
								}}
								disabled={isDeleting}
							>
								<Trash2 className="h-4 w-4" />
								<span className="sr-only">Delete</span>
							</Button>
						</div>
					);
				},
			},
		],
		[onApprove, onDelete, isApproving, isDeleting, handleEditClick]
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters: effectiveColumnFilters,
			rowSelection,
			globalFilter,
			expanded,
			pagination,
		},
		manualPagination: false,
		enableRowSelection: true,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: (updater) => {
			const newSelection = typeof updater === "function" ? updater(rowSelection) : updater;
			setRowSelection(newSelection);
			const selectedIds = Object.keys(newSelection).filter((key) => newSelection[key]);
			const selectedLeadIds = selectedIds
				.map((index) => data[parseInt(index, 10)]?.id)
				.filter(Boolean);
			onSelectionChange?.(selectedLeadIds as string[]);
		},
		onGlobalFilterChange: setGlobalFilter,
		onExpandedChange: setExpanded,
		onPaginationChange: (updater) => {
			const newPagination = typeof updater === "function" ? updater(pagination) : updater;
			if (newPagination.pageSize !== pageSize) {
				onPageSizeChange?.(newPagination.pageSize);
			}
			if (newPagination.pageIndex !== pageIndex) {
				onPageIndexChange?.(newPagination.pageIndex);
			}
		},
		getRowCanExpand: (row) =>
			row.original.validationResult.errors.length > 0 ||
			row.original.validationResult.warnings.length > 0,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		filterFns: {
			fuzzy: fuzzyFilter,
		},
	});

	const statusOptions: StagingStatus[] = ["PENDING_REVIEW", "VALIDATED", "REJECTED", "APPROVED"];

	return (
		<>
			<div className="space-y-4">
				{/* Filters */}
				<div className="flex flex-wrap items-center gap-4">
					<div className="relative flex-1 min-w-62.5 max-w-sm">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search staged leads..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Select
						value={statusFilter || "all"}
						defaultValue="all"
						onValueChange={(value) => {
							onStatusFilterChange?.(value);
						}}
					>
						<SelectTrigger className="w-45">
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							{statusOptions.map((status) => (
								<SelectItem key={status} value={status}>
									{status.replace(/_/g, " ")}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Table */}
				<div className="rounded-lg border bg-card shadow-sm">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id} className="hover:bg-transparent">
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											style={{
												width: header.getSize() !== 150 ? header.getSize() : undefined,
											}}
											className="bg-muted/50"
										>
											{header.isPlaceholder
												? null
												: flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-24 text-center">
										<div className="flex items-center justify-center gap-2">
											<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
											Loading staged leads...
										</div>
									</TableCell>
								</TableRow>
							) : error ? (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-32 text-center">
										<div className="flex flex-col items-center justify-center gap-3">
											<AlertCircle className="h-8 w-8 text-destructive" />
											<div className="space-y-1">
												<p className="font-medium text-destructive">Failed to load staged leads</p>
												<p className="text-sm text-muted-foreground">
													{error.message || "An unexpected error occurred"}
												</p>
											</div>
											{onRetry && (
												<Button variant="outline" size="sm" onClick={onRetry}>
													<RefreshCw className="mr-2 h-4 w-4" />
													Try Again
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<>
										<TableRow
											key={row.id}
											data-state={row.getIsSelected() && "selected"}
											className={cn(
												"transition-colors",
												row.getIsSelected() && "bg-muted/50",
												!row.original.validationResult.valid && "bg-red-50/50 dark:bg-red-950/20"
											)}
										>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id}>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											))}
										</TableRow>
										{row.getIsExpanded() && (
											<TableRow className="bg-muted/30 hover:bg-muted/30">
												<TableCell colSpan={columns.length} className="p-4">
													<ValidationDetails validation={row.original.validationResult} />
												</TableCell>
											</TableRow>
										)}
									</>
								))
							) : (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-24 text-center">
										<div className="text-muted-foreground">No staged leads found.</div>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				{/* Pagination */}
				<div className="flex items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">
						{table.getFilteredSelectedRowModel().rows.length} of{" "}
						{table.getFilteredRowModel().rows.length} row(s) selected.
					</div>
					<div className="flex items-center space-x-6 lg:space-x-8">
						<div className="flex items-center space-x-2">
							<p className="text-sm font-medium">Rows per page</p>
							<Select
								value={`${table.getState().pagination.pageSize}`}
								defaultValue="10"
								onValueChange={(value) => table.setPageSize(Number(value))}
							>
								<SelectTrigger className="h-8 w-17.5">
									<SelectValue placeholder="10" />
								</SelectTrigger>
								<SelectContent side="top">
									{[10, 20, 30, 40, 50].map((pageSize) => (
										<SelectItem key={pageSize} value={`${pageSize}`}>
											{pageSize}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex w-25 items-center justify-center text-sm font-medium">
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
						</div>
						<div className="flex items-center space-x-2">
							<Button
								variant="outline"
								className="hidden h-8 w-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(0)}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to first page</span>
								<ChevronsLeft className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								className="h-8 w-8 p-0"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								<span className="sr-only">Go to previous page</span>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								className="h-8 w-8 p-0"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to next page</span>
								<ChevronRight className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								className="hidden h-8 w-8 p-0 lg:flex"
								onClick={() => table.setPageIndex(table.getPageCount() - 1)}
								disabled={!table.getCanNextPage()}
							>
								<span className="sr-only">Go to last page</span>
								<ChevronsRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Edit Dialog */}
			<Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
				<DialogContent className="sm:max-w-125">
					<DialogHeader>
						<DialogTitle>Edit Staged Lead</DialogTitle>
						<DialogDescription>
							Make changes to the lead data. The lead will be re-validated after saving.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="fullName">Full Name</Label>
							<Input
								id="fullName"
								value={editFormData.fullName}
								onChange={(e) => setEditFormData((prev) => ({ ...prev, fullName: e.target.value }))}
								className={cn(
									editingLead?.validationResult.nameValidation.errors.length &&
										"border-red-300 focus-visible:ring-red-500"
								)}
							/>
							{editingLead?.validationResult.nameValidation.errors.map((error, i) => (
								<p key={i} className="text-sm text-red-600">
									{error}
								</p>
							))}
						</div>
						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={editFormData.email}
								onChange={(e) => setEditFormData((prev) => ({ ...prev, email: e.target.value }))}
								className={cn(
									editingLead?.validationResult.emailValidation.errors.length &&
										"border-red-300 focus-visible:ring-red-500"
								)}
							/>
							{editingLead?.validationResult.emailValidation.errors.map((error, i) => (
								<p key={i} className="text-sm text-red-600">
									{error}
								</p>
							))}
						</div>
						<div className="grid gap-2">
							<Label htmlFor="companyName">Company Name</Label>
							<Input
								id="companyName"
								value={editFormData.companyName}
								onChange={(e) =>
									setEditFormData((prev) => ({ ...prev, companyName: e.target.value }))
								}
								className={cn(
									editingLead?.validationResult.companyValidation.errors.length &&
										"border-red-300 focus-visible:ring-red-500"
								)}
							/>
							{editingLead?.validationResult.companyValidation.errors.map((error, i) => (
								<p key={i} className="text-sm text-red-600">
									{error}
								</p>
							))}
						</div>
						<div className="grid gap-2">
							<Label htmlFor="phoneNumber">Phone Number</Label>
							<Input
								id="phoneNumber"
								value={editFormData.phoneNumber}
								onChange={(e) =>
									setEditFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))
								}
								className={cn(
									editingLead?.validationResult.phoneValidation?.errors?.length &&
										"border-red-300 focus-visible:ring-red-500"
								)}
							/>
							{editingLead?.validationResult.phoneValidation?.errors?.map((error, i) => (
								<p key={i} className="text-sm text-red-600">
									{error}
								</p>
							))}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingLead(null)}>
							Cancel
						</Button>
						<Button onClick={handleSaveEdit}>Save changes</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

// Validation Details Component
function ValidationDetails({ validation }: { validation: StagedLead["validationResult"] }) {
	return (
		<div className="space-y-4">
			{/* Errors */}
			{validation.errors.length > 0 && (
				<Alert variant="destructive" className="bg-red-50 border-red-200">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<div className="font-medium mb-2">Validation Errors</div>
						<ul className="list-disc list-inside space-y-1">
							{validation.errors.map((error, i) => (
								<li key={i} className="text-sm">
									<span className="font-medium capitalize">{error.field}:</span> {error.message}
								</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}

			{/* Warnings */}
			{validation.warnings.length > 0 && (
				<Alert className="bg-amber-50 border-amber-200">
					<AlertTriangle className="h-4 w-4 text-amber-600" />
					<AlertDescription className="text-amber-800">
						<div className="font-medium mb-2">Warnings</div>
						<ul className="list-disc list-inside space-y-1">
							{validation.warnings.map((warning, i) => (
								<li key={i} className="text-sm">
									<span className="font-medium capitalize">{warning.field}:</span> {warning.message}
								</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}

			{/* Detailed Validation Info */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
				{/* Name Validation */}
				<div className="p-3 rounded-lg bg-background border">
					<div className="font-medium mb-2 flex items-center gap-2">
						<User className="h-4 w-4 text-muted-foreground" />
						Name Analysis
					</div>
					<div className="space-y-1 text-muted-foreground">
						<div>
							Pattern:{" "}
							<span className="text-foreground">
								{validation.nameValidation.metadata.detectedPattern.replace(/_/g, " ")}
							</span>
						</div>
						<div>
							Tokens:{" "}
							<span className="text-foreground">
								{validation.nameValidation.metadata.tokenCount}
							</span>
						</div>
						<div>
							Has Surname:{" "}
							<span className="text-foreground">
								{validation.nameValidation.metadata.hasSurname ? "Yes" : "No"}
							</span>
						</div>
					</div>
				</div>

				{/* Email Validation */}
				<div className="p-3 rounded-lg bg-background border">
					<div className="font-medium mb-2 flex items-center gap-2">
						<Mail className="h-4 w-4 text-muted-foreground" />
						Email Analysis
					</div>
					<div className="space-y-1 text-muted-foreground">
						<div>
							Domain: <span className="text-foreground">{validation.emailValidation.domain}</span>
						</div>
						<div>
							Type:{" "}
							<span className="text-foreground">
								{validation.emailValidation.isCorporate ? "Corporate" : "Free"}
							</span>
						</div>
						<div>
							Normalized:{" "}
							<span className="text-foreground">{validation.emailValidation.normalized}</span>
						</div>
					</div>
				</div>

				{/* Company Validation */}
				<div className="p-3 rounded-lg bg-background border">
					<div className="font-medium mb-2 flex items-center gap-2">
						<Building2 className="h-4 w-4 text-muted-foreground" />
						Company Analysis
					</div>
					<div className="space-y-1 text-muted-foreground">
						<div>
							Normalized:{" "}
							<span className="text-foreground">{validation.companyValidation.normalized}</span>
						</div>
						<div>
							Valid:{" "}
							<span className="text-foreground">
								{validation.companyValidation.valid ? "Yes" : "No"}
							</span>
						</div>
					</div>
				</div>

				{/* Phone Validation */}
				{validation.phoneValidation && (
					<div className="p-3 rounded-lg bg-background border">
						<div className="font-medium mb-2 flex items-center gap-2">
							<Phone className="h-4 w-4 text-muted-foreground" />
							Phone Analysis
						</div>
						<div className="space-y-1 text-muted-foreground">
							<div>
								Normalized:{" "}
								<span className="text-foreground">
									{validation.phoneValidation.normalized || "N/A"}
								</span>
							</div>
							<div>
								Valid:{" "}
								<span className="text-foreground">
									{validation.phoneValidation.valid ? "Yes" : "No"}
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
