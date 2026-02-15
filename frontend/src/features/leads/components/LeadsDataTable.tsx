/**
 * Leads Data Table Component
 *
 * Premium data table for leads with TanStack Table.
 * Features:
 * - Sorting and filtering
 * - Row selection
 * - Status badges with semantic colors
 * - Responsive design
 */

import { rankItem } from "@tanstack/match-sorter-utils";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	AlertCircle,
	ArrowUpDown,
	Building2,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Mail,
	Phone,
	RefreshCw,
	Search,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import type { Lead, LeadStatus } from "../types";
import { LeadStatusBadge } from "./LeadStatusBadge";

// Define fuzzy filter function
const fuzzyFilter: FilterFn<Lead> = (row, columnId, value, addMeta) => {
	const itemRank = rankItem(row.getValue(columnId), value);
	addMeta({ itemRank });
	return itemRank.passed;
};

interface LeadsDataTableProps {
	data: Lead[];
	isLoading?: boolean;
	isPending?: boolean;
	error?: Error | null;
	onRetry?: () => void;
	onRowClick?: (lead: Lead) => void;
	onSelectionChange?: (selectedIds: string[]) => void;
	// URL-driven state
	statusFilter?: string;
	onStatusFilterChange?: (status: string) => void;
	pageSize?: number;
	onPageSizeChange?: (size: number) => void;
	pageIndex?: number;
	onPageIndexChange?: (index: number) => void;
	// Ref for clearing selection from parent
	clearSelectionRef?: React.MutableRefObject<(() => void) | null>;
}

export function LeadsDataTable({
	data,
	isLoading,
	isPending,
	error,
	onRetry,
	onRowClick,
	onSelectionChange,
	statusFilter = "all",
	onStatusFilterChange,
	pageSize = 10,
	onPageSizeChange,
	pageIndex = 0,
	onPageIndexChange,
	clearSelectionRef,
}: LeadsDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [globalFilter, setGlobalFilter] = useState("");

	// Expose clear selection function via ref
	if (clearSelectionRef) {
		clearSelectionRef.current = () => setRowSelection({});
	}

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

	const columns = useMemo<ColumnDef<Lead>[]>(
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
				cell: ({ row }) => (
					<div className="flex flex-col">
						<span className="font-medium text-foreground">{row.getValue("fullName")}</span>
						{row.original.parsedFirstName && (
							<span className="text-xs text-muted-foreground">
								First: {row.original.parsedFirstName}
							</span>
						)}
					</div>
				),
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
				cell: ({ row }) => (
					<a
						href={`mailto:${row.getValue("email")}`}
						className="text-primary hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{row.getValue("email")}
					</a>
				),
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
				cell: ({ row }) => <span className="text-foreground">{row.getValue("companyName")}</span>,
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
					return phone ? (
						<a
							href={`tel:${phone}`}
							className="text-muted-foreground hover:text-foreground"
							onClick={(e) => e.stopPropagation()}
						>
							{phone}
						</a>
					) : (
						<span className="text-muted-foreground/50">—</span>
					);
				},
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => <LeadStatusBadge status={row.getValue("status") as LeadStatus} />,
				filterFn: (row, id, value) => {
					return value.includes(row.getValue(id));
				},
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2 -ml-2 hover:bg-accent"
					>
						Created
						<ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/70" />
					</Button>
				),
				cell: ({ row }) => {
					const date = new Date(row.getValue("createdAt"));
					return (
						<span className="text-muted-foreground text-sm">
							{date.toLocaleDateString("en-IN", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</span>
					);
				},
			},
		],
		[]
	);

	// Derive pagination state from URL params
	const pagination = useMemo(
		() => ({
			pageIndex,
			pageSize,
		}),
		[pageIndex, pageSize]
	);

	const table = useReactTable({
		data,
		columns,
		state: {
			sorting,
			columnFilters: effectiveColumnFilters,
			rowSelection,
			globalFilter,
			pagination,
		},
		manualPagination: false,
		enableRowSelection: true,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onRowSelectionChange: (updater) => {
			const newSelection = typeof updater === "function" ? updater(rowSelection) : updater;
			setRowSelection(newSelection);
			const selectedRowIds = Object.keys(newSelection).filter((key) => newSelection[key]);
			const selectedLeadIds = selectedRowIds
				.map((index) => data[parseInt(index, 10)]?.id)
				.filter(Boolean);
			onSelectionChange?.(selectedLeadIds as string[]);
		},
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: (updater) => {
			const newPagination = typeof updater === "function" ? updater(pagination) : updater;
			if (newPagination.pageSize !== pageSize) {
				onPageSizeChange?.(newPagination.pageSize);
			}
			if (newPagination.pageIndex !== pageIndex) {
				onPageIndexChange?.(newPagination.pageIndex);
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		filterFns: {
			fuzzy: fuzzyFilter,
		},
	});

	const statusOptions: LeadStatus[] = [
		"PENDING_IMPORT",
		"VERIFIED",
		"QUEUED",
		"SENT",
		"DELIVERED",
		"BOUNCED",
		"COMPLAINED",
		"FAILED",
		"SKIPPED_DAILY_CAP",
		"UNSUBSCRIBED",
	];

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-wrap items-center gap-4">
				<div className="relative flex-1 min-w-62.5 max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search leads..."
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
										style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
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
										Loading leads...
									</div>
								</TableCell>
							</TableRow>
						) : error ? (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-32 text-center">
									<div className="flex flex-col items-center justify-center gap-3">
										<AlertCircle className="h-8 w-8 text-destructive" />
										<div className="space-y-1">
											<p className="font-medium text-destructive">Failed to load leads</p>
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
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									onClick={() => onRowClick?.(row.original)}
									className={cn(
										"cursor-pointer transition-colors",
										row.getIsSelected() && "bg-muted/50"
									)}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									<div className="text-muted-foreground">No leads found.</div>
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
							disabled={isPending || !table.getCanPreviousPage()}
						>
							<span className="sr-only">Go to first page</span>
							<ChevronsLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0"
							onClick={() => table.previousPage()}
							disabled={isPending || !table.getCanPreviousPage()}
						>
							<span className="sr-only">Go to previous page</span>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="h-8 w-8 p-0"
							onClick={() => table.nextPage()}
							disabled={isPending || !table.getCanNextPage()}
						>
							<span className="sr-only">Go to next page</span>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							className="hidden h-8 w-8 p-0 lg:flex"
							onClick={() => table.setPageIndex(table.getPageCount() - 1)}
							disabled={isPending || !table.getCanNextPage()}
						>
							<span className="sr-only">Go to last page</span>
							<ChevronsRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
