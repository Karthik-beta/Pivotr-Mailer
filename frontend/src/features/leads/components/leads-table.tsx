import type { Lead } from "@shared/types/lead.types";
import {
	flexRender,
	getCoreRowModel,
	type PaginationState,
	useReactTable,
} from "@tanstack/react-table";
import { Loader2, Plus, Users } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { useDeleteLead, useLeads } from "../hooks/use-leads";
import { AddLeadDialog } from "./add-lead-dialog";
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
	const { mutate: deleteLead, isPending: isDeleting } = useDeleteLead();

	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

	const handleReviewClick = (lead: Lead) => {
		setSelectedLead(lead);
		setDrawerOpen(true);
	};

	const handleDeleteClick = (lead: Lead) => {
		setLeadToDelete(lead);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		if (leadToDelete) {
			deleteLead(leadToDelete.$id);
			setDeleteDialogOpen(false);
			setLeadToDelete(null);
		}
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
		columns: columns(handleReviewClick, handleDeleteClick),
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
								<TableCell colSpan={table.getAllColumns().length} className="h-48">
									<div className="flex flex-col items-center justify-center text-center py-8">
										<div className="bg-muted/50 rounded-full p-4 mb-4">
											<Users className="h-8 w-8 text-muted-foreground" />
										</div>
										<h3 className="text-lg font-medium mb-1">No leads found</h3>
										<p className="text-muted-foreground text-sm mb-4">
											Get started by adding your first lead.
										</p>
										<AddLeadDialog
											trigger={
												<Button className="gap-2">
													<Plus className="h-4 w-4" />
													Add Lead
												</Button>
											}
										/>
									</div>
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

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete the lead for <span className="font-medium text-foreground">{leadToDelete?.email}</span>.
							This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								confirmDelete();
							}}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
						>
							{isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
