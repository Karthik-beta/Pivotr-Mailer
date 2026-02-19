/**
 * Leads Page
 *
 * Main leads management page with premium data table.
 * Uses URL-driven state for table filtering and pagination.
 */

import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	Download,
	FileSpreadsheet,
	Loader2,
	Plus,
	RefreshCw,
	TrendingUp,
	Upload,
	Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkActionsToolbar } from "@/features/leads/components/BulkActionsToolbar";
import { LeadFormDialog } from "@/features/leads/components/LeadFormDialog";
import { LeadsDataTable } from "@/features/leads/components/LeadsDataTable";
import {
	leadsQueryOptions,
	useDownloadTemplate,
	useExportLeads,
	useLeads,
} from "@/features/leads/hooks/useLeads";
import type { Lead } from "@/features/leads/types";
import { Layout } from "@/features/shared/Layout";

// Search params schema for URL-driven table state
const leadsSearchSchema = z.object({
	status: z.string().catch("all"),
	page: z.number().catch(0),
	pageSize: z.number().catch(10),
});

export const Route = createFileRoute("/_app/leads/")({
	component: LeadsPage,
	validateSearch: leadsSearchSchema,
	loader: ({ context }) => {
		const queryOpts = leadsQueryOptions({ limit: 100 });
		if (context.queryClient.getQueryData(queryOpts.queryKey)) {
			void context.queryClient.prefetchQuery(queryOpts);
			return;
		}
		return context.queryClient.prefetchQuery(queryOpts);
	},
});

function LeadsPage() {
	const navigate = Route.useNavigate();
	const { status, page, pageSize } = Route.useSearch();
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const clearSelectionRef = useRef<(() => void) | null>(null);
	const { data, isLoading, isPending, error, refetch, isRefetching } = useLeads({ limit: 100 });
	const exportMutation = useExportLeads();
	const templateMutation = useDownloadTemplate();

	// Lead form dialog state
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

	// URL state update handlers
	const handleStatusFilterChange = (newStatus: string) => {
		navigate({
			search: (prev) => ({ ...prev, status: newStatus, page: 0 }),
			replace: true,
		});
	};

	const handlePageSizeChange = (newPageSize: number) => {
		navigate({
			search: (prev) => ({ ...prev, pageSize: newPageSize, page: 0 }),
			replace: true,
		});
	};

	const handlePageIndexChange = (newPageIndex: number) => {
		navigate({
			search: (prev) => ({ ...prev, page: newPageIndex }),
			replace: true,
		});
	};

	const leads = data?.data || [];

	// Calculate stats
	const stats = {
		total: leads.length,
		delivered: leads.filter((l) => l.status === "DELIVERED").length,
		pending: leads.filter((l) => ["PENDING_IMPORT", "QUEUED", "VERIFIED"].includes(l.status))
			.length,
		failed: leads.filter((l) => ["BOUNCED", "FAILED", "COMPLAINED"].includes(l.status)).length,
	};

	const handleRowClick = (lead: Lead) => {
		console.log("Lead clicked:", lead);
	};

	// Dialog handlers
	const handleAddLead = () => {
		setSelectedLead(null);
		setDialogMode("add");
		setDialogOpen(true);
	};

	const handleEditLead = (lead: Lead) => {
		setSelectedLead(lead);
		setDialogMode("edit");
		setDialogOpen(true);
	};

	const handleClearSelection = () => {
		setSelectedIds([]);
		if (clearSelectionRef.current) {
			clearSelectionRef.current();
		}
	};

	return (
		<Layout
			breadcrumbs={
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Leads</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			}
		>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Leads</h1>
						<p className="text-muted-foreground">Manage your leads and track email campaigns.</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
							<RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
							Refresh
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => templateMutation.mutate()}
							disabled={templateMutation.isPending}
						>
							{templateMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<FileSpreadsheet className="mr-2 h-4 w-4" />
							)}
							Template
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => exportMutation.mutate({})}
							disabled={exportMutation.isPending}
						>
							{exportMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Download className="mr-2 h-4 w-4" />
							)}
							Export
						</Button>
						<Button size="sm" onClick={handleAddLead}>
							<Plus className="mr-2 h-4 w-4" />
							Add Lead
						</Button>
						<Button size="sm" asChild>
							<a href="/leads/staging">
								<Upload className="mr-2 h-4 w-4" />
								Import Leads
							</a>
						</Button>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card className="bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Leads</CardTitle>
							<Users className="h-4 w-4 text-slate-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
							<p className="text-xs text-muted-foreground">All imported leads</p>
						</CardContent>
					</Card>

					<Card className="bg-linear-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Delivered</CardTitle>
							<CheckCircle2 className="h-4 w-4 text-emerald-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
								{stats.delivered.toLocaleString()}
							</div>
							<p className="text-xs text-emerald-600/70">Successfully delivered</p>
						</CardContent>
					</Card>

					<Card className="bg-linear-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Pending</CardTitle>
							<TrendingUp className="h-4 w-4 text-amber-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
								{stats.pending.toLocaleString()}
							</div>
							<p className="text-xs text-amber-600/70">Queued for sending</p>
						</CardContent>
					</Card>

					<Card className="bg-linear-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Failed</CardTitle>
							<AlertTriangle className="h-4 w-4 text-red-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-red-700 dark:text-red-400">
								{stats.failed.toLocaleString()}
							</div>
							<p className="text-xs text-red-600/70">Bounced or failed</p>
						</CardContent>
					</Card>
				</div>

				{/* Data Table */}
				<Card>
					<CardHeader>
						<CardTitle>All Leads</CardTitle>
						<CardDescription>
							View and manage all your leads. Click on a row to see details.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<LeadsDataTable
							data={leads}
							isLoading={isLoading}
							isPending={isPending}
							error={error}
							onRetry={() => refetch()}
							onRowClick={handleRowClick}
							onEditLead={handleEditLead}
							onSelectionChange={setSelectedIds}
							statusFilter={status}
							onStatusFilterChange={handleStatusFilterChange}
							pageSize={pageSize}
							onPageSizeChange={handlePageSizeChange}
							pageIndex={page}
							onPageIndexChange={handlePageIndexChange}
							clearSelectionRef={clearSelectionRef}
						/>
					</CardContent>
				</Card>
			</div>

			{/* Bulk Actions Toolbar */}
			<BulkActionsToolbar
				selectedIds={selectedIds}
				onClearSelection={handleClearSelection}
				onActionComplete={() => refetch()}
			/>

			{/* Lead Form Dialog */}
			<LeadFormDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mode={dialogMode}
				lead={selectedLead}
				onSuccess={() => refetch()}
			/>
		</Layout>
	);
}
