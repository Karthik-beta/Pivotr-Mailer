import type { Lead } from "@shared/types/lead.types";
import {
	flexRender,
	getCoreRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useLeads } from "../hooks/use-leads";
import { columns } from "./columns";
import { NameParserDrawer } from "./name-parser-drawer";

interface LeadsTableProps {
	page: number;
	search?: string;
	onPageChange: (page: number) => void;
}

export function LeadsTable({ page, search, onPageChange }: LeadsTableProps) {
	const limit = 20;
	// Ensure page is at least 1 for API
	const apiPage = Math.max(1, page);

	// useSuspenseQuery will suspend if data is not ready
	const { data, refetch } = useLeads(apiPage, limit, search);

	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const handleReviewClick = (lead: Lead) => {
		setSelectedLead(lead);
		setDrawerOpen(true);
	};

	const handleNameSaved = () => {
		refetch(); // Refresh list to show updated name
	};

	// Table Configuration
	const tableData = data?.leads ?? [];
	const totalLeads = data?.total ?? 0;
	const pageCount = Math.ceil(totalLeads / limit);

	// Sync pagination state with props (URL is SSOT)
	const pagination: PaginationState = {
		pageIndex: apiPage - 1,
		pageSize: limit,
	};

	const table = useReactTable({
		data: tableData,
		columns: columns(handleReviewClick),
		pageCount,
		state: {
			pagination,
		},
		manualPagination: true,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="space-y-4">
			<div className="rounded-md border bg-card">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead
											key={header.id}
											className={header.column.id === "actions" ? "text-right" : ""}
										>
											{header.isPlaceholder
												? null
												: flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={cell.column.id === "actions" ? "text-right" : ""}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									No leads found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{pageCount > 1 && (
				<Pagination>
					<PaginationContent>
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (table.getCanPreviousPage()) {
										// Update URL via prop
										onPageChange(apiPage - 1);
									}
								}}
								className={
									!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"
								}
							/>
						</PaginationItem>
						<PaginationItem>
							<span className="px-4 text-sm text-muted-foreground">
								Page {apiPage} of {pageCount}
							</span>
						</PaginationItem>
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (table.getCanNextPage()) {
										// Update URL via prop
										onPageChange(apiPage + 1);
									}
								}}
								className={
									!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}

			<NameParserDrawer
				lead={selectedLead}
				open={drawerOpen}
				onOpenChange={setDrawerOpen}
				onSaved={handleNameSaved}
			/>
		</div>
	);
}
