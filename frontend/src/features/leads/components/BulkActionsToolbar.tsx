/**
 * Bulk Actions Toolbar Component
 *
 * Floating toolbar that appears when rows are selected in the leads table.
 * Provides bulk actions: Delete, Change Status, Assign to Campaign, Export.
 */

import {
	AlertTriangle,
	CheckCircle2,
	Download,
	Loader2,
	MoreHorizontal,
	Trash2,
	UserPlus,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCampaigns } from "@/features/campaigns/hooks/useCampaigns";
import { useBulkDeleteLeads, useBulkUpdateLeads, useExportSelectedLeads } from "../hooks/useLeads";
import type { LeadStatus } from "../types";

interface BulkActionsToolbarProps {
	selectedIds: string[];
	onClearSelection: () => void;
	onActionComplete?: () => void;
}

export function BulkActionsToolbar({
	selectedIds,
	onClearSelection,
	onActionComplete,
}: BulkActionsToolbarProps) {
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [showStatusDialog, setShowStatusDialog] = useState(false);
	const [showCampaignDialog, setShowCampaignDialog] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState<LeadStatus | "">("");
	const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

	const bulkDeleteMutation = useBulkDeleteLeads();
	const bulkUpdateMutation = useBulkUpdateLeads();
	const exportSelectedMutation = useExportSelectedLeads();
	const { data: campaignsData } = useCampaigns({ limit: 100 });

	// Handlers that prevent closing dialog while mutation is in progress
	const handleDeleteDialogOpenChange = (open: boolean) => {
		// Don't close if mutation is in progress
		if (!open && bulkDeleteMutation.isPending) return;
		setShowDeleteDialog(open);
	};

	const handleStatusDialogOpenChange = (open: boolean) => {
		// Don't close if mutation is in progress
		if (!open && bulkUpdateMutation.isPending) return;
		setShowStatusDialog(open);
		if (!open) setSelectedStatus("");
	};

	const handleCampaignDialogOpenChange = (open: boolean) => {
		// Don't close if mutation is in progress
		if (!open && bulkUpdateMutation.isPending) return;
		setShowCampaignDialog(open);
		if (!open) setSelectedCampaignId("");
	};

	const campaigns = campaignsData?.data || [];
	const selectedCount = selectedIds.length;

	const handleDelete = async () => {
		if (selectedIds.length === 0) return;

		try {
			const result = await bulkDeleteMutation.mutateAsync(selectedIds);
			if (result.success) {
				toast.success(`Successfully deleted ${result.data.deleted} lead(s)`);
				if (result.data.failed > 0) {
					toast.warning(`Failed to delete ${result.data.failed} lead(s)`);
				}
				onClearSelection();
				onActionComplete?.();
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete leads");
		} finally {
			setShowDeleteDialog(false);
		}
	};

	const handleStatusChange = async () => {
		if (selectedIds.length === 0 || !selectedStatus) return;

		try {
			const result = await bulkUpdateMutation.mutateAsync({
				ids: selectedIds,
				updates: { status: selectedStatus },
			});
			if (result.success) {
				toast.success(`Successfully updated ${result.data.updated} lead(s)`);
				if (result.data.failed > 0) {
					toast.warning(`Failed to update ${result.data.failed} lead(s)`);
				}
				onClearSelection();
				onActionComplete?.();
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update leads");
		} finally {
			setShowStatusDialog(false);
			setSelectedStatus("");
		}
	};

	const handleAssignCampaign = async () => {
		if (selectedIds.length === 0 || !selectedCampaignId) return;

		try {
			const result = await bulkUpdateMutation.mutateAsync({
				ids: selectedIds,
				updates: { campaignId: selectedCampaignId },
			});
			if (result.success) {
				toast.success(`Successfully assigned ${result.data.updated} lead(s) to campaign`);
				if (result.data.failed > 0) {
					toast.warning(`Failed to assign ${result.data.failed} lead(s)`);
				}
				onClearSelection();
				onActionComplete?.();
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to assign leads to campaign");
		} finally {
			setShowCampaignDialog(false);
			setSelectedCampaignId("");
		}
	};

	const handleExport = async () => {
		if (selectedIds.length === 0) return;

		try {
			await exportSelectedMutation.mutateAsync(selectedIds);
			toast.success(`Exported ${selectedIds.length} lead(s) successfully`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to export leads");
		}
	};

	if (selectedCount === 0) return null;

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
		<>
			{/* Floating Toolbar */}
			<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
				<div className="flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 shadow-lg">
					<span className="text-sm font-medium">
						{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
					</span>

					<div className="h-4 w-px bg-border mx-2" />

					<Button
						variant="ghost"
						size="sm"
						onClick={onClearSelection}
						className="text-muted-foreground hover:text-foreground"
					>
						<X className="mr-1 h-4 w-4" />
						Clear
					</Button>

					<div className="h-4 w-px bg-border mx-2" />

					<Button
						variant="outline"
						size="sm"
						onClick={handleExport}
						disabled={exportSelectedMutation.isPending}
					>
						{exportSelectedMutation.isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Download className="mr-2 h-4 w-4" />
						)}
						Export
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<MoreHorizontal className="mr-2 h-4 w-4" />
								Actions
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem onClick={() => setShowStatusDialog(true)}>
								<CheckCircle2 className="mr-2 h-4 w-4" />
								Change Status
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setShowCampaignDialog(true)}>
								<UserPlus className="mr-2 h-4 w-4" />
								Assign to Campaign
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => setShowDeleteDialog(true)}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete Selected
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={handleDeleteDialogOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Delete Leads
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete {selectedCount} lead(s)? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={bulkDeleteMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={bulkDeleteMutation.isPending}
						>
							{bulkDeleteMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Trash2 className="mr-2 h-4 w-4" />
							)}
							Delete {selectedCount} Lead(s)
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Change Status Dialog */}
			<Dialog open={showStatusDialog} onOpenChange={handleStatusDialogOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change Status</DialogTitle>
						<DialogDescription>
							Select a new status for {selectedCount} selected lead(s).
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Select
							value={selectedStatus}
							onValueChange={(v) => setSelectedStatus(v as LeadStatus)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a status" />
							</SelectTrigger>
							<SelectContent>
								{statusOptions.map((status) => (
									<SelectItem key={status} value={status}>
										{status.replace(/_/g, " ")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowStatusDialog(false);
								setSelectedStatus("");
							}}
							disabled={bulkUpdateMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={handleStatusChange}
							disabled={!selectedStatus || bulkUpdateMutation.isPending}
						>
							{bulkUpdateMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<CheckCircle2 className="mr-2 h-4 w-4" />
							)}
							Update Status
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Assign to Campaign Dialog */}
			<Dialog open={showCampaignDialog} onOpenChange={handleCampaignDialogOpenChange}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Assign to Campaign</DialogTitle>
						<DialogDescription>
							Select a campaign to assign {selectedCount} selected lead(s).
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a campaign" />
							</SelectTrigger>
							<SelectContent>
								{campaigns.length === 0 ? (
									<div className="px-2 py-4 text-center text-sm text-muted-foreground">
										No campaigns available
									</div>
								) : (
									campaigns.map((campaign) => (
										<SelectItem key={campaign.id} value={campaign.id}>
											{campaign.name}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setShowCampaignDialog(false);
								setSelectedCampaignId("");
							}}
							disabled={bulkUpdateMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={handleAssignCampaign}
							disabled={!selectedCampaignId || bulkUpdateMutation.isPending}
						>
							{bulkUpdateMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<UserPlus className="mr-2 h-4 w-4" />
							)}
							Assign to Campaign
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
