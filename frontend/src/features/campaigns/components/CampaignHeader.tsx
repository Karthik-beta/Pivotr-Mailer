/**
 * CampaignHeader Component
 *
 * Header section for campaign detail page with title, status, and action buttons.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Edit, Mail, Pause, Play, Send, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChangeCampaignStatus, useDeleteCampaign } from "../hooks/useCampaigns";
import type { Campaign, CampaignStatus } from "../types";
import { CampaignStatusBadge } from "./CampaignStatusBadge";
import { ConfirmStatusDialog } from "./ConfirmStatusDialog";
import { TestEmailDialog } from "./TestEmailDialog";

interface CampaignHeaderProps {
	campaign: Campaign;
}

// Determine available actions based on status
// Flow: RUNNING → Pause → Abort → Delete
function getAvailableActions(status: CampaignStatus) {
	return {
		canEdit: status === "DRAFT",
		canStart: status === "DRAFT" || status === "QUEUED",
		canPause: status === "RUNNING",
		canResume: status === "PAUSED",
		canAbort: ["QUEUED", "PAUSED"].includes(status),
		canDelete: ["DRAFT", "COMPLETED", "ABORTED", "ERROR"].includes(status),
		canAssignLeads: ["DRAFT", "QUEUED"].includes(status),
		canTestEmail: !["ABORTED", "ABORTING", "COMPLETED", "ERROR"].includes(status),
	};
}

export function CampaignHeader({ campaign }: CampaignHeaderProps) {
	const navigate = useNavigate();
	const changeStatusMutation = useChangeCampaignStatus();
	const deleteMutation = useDeleteCampaign();

	const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
	const [confirmAction, setConfirmAction] = useState<
		"start" | "pause" | "resume" | "abort" | "delete" | null
	>(null);

	const actions = getAvailableActions(campaign.status);

	const handleStatusChange = async (newStatus: CampaignStatus) => {
		try {
			await changeStatusMutation.mutateAsync({
				id: campaign.id,
				status: newStatus,
			});
			toast.success(`Campaign ${newStatus.toLowerCase()} successfully!`);
			setConfirmAction(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to change status");
		}
	};

	const handleDelete = async () => {
		try {
			await deleteMutation.mutateAsync(campaign.id);
			toast.success("Campaign deleted successfully!");
			setConfirmAction(null);
			navigate({ to: "/campaigns", search: { status: "all" } });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete campaign");
		}
	};

	const handleConfirmAction = () => {
		switch (confirmAction) {
			case "start":
				handleStatusChange("QUEUED");
				break;
			case "pause":
				handleStatusChange("PAUSED");
				break;
			case "resume":
				handleStatusChange("RUNNING");
				break;
			case "abort":
				handleStatusChange("ABORTED");
				break;
			case "delete":
				handleDelete();
				break;
		}
	};

	const isLoading = changeStatusMutation.isPending || deleteMutation.isPending;

	return (
		<>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex items-start gap-4">
					<div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
						<Mail className="h-6 w-6 text-primary" />
					</div>
					<div>
						<div className="flex items-center gap-3 flex-wrap">
							<h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
							<CampaignStatusBadge status={campaign.status} />
						</div>
						<p className="text-muted-foreground mt-1">{campaign.description || "No description"}</p>
						<p className="text-xs text-muted-foreground font-mono mt-2">
							Created{" "}
							{campaign.createdAt && !Number.isNaN(new Date(campaign.createdAt).getTime())
								? format(new Date(campaign.createdAt), "MMM d, yyyy HH:mm")
								: "N/A"}{" "}
							| Updated{" "}
							{campaign.updatedAt && !Number.isNaN(new Date(campaign.updatedAt).getTime())
								? format(new Date(campaign.updatedAt), "MMM d, yyyy HH:mm")
								: "N/A"}
						</p>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{/* Edit Button */}
					{actions.canEdit && (
						<Button variant="outline" size="sm" asChild>
							<Link to="/campaigns/$id/edit" params={{ id: campaign.id }}>
								<Edit className="mr-2 h-4 w-4" />
								Edit
							</Link>
						</Button>
					)}

					{/* Start Button */}
					{actions.canStart && (
						<Button size="sm" onClick={() => setConfirmAction("start")} disabled={isLoading}>
							<Play className="mr-2 h-4 w-4" />
							{campaign.status === "QUEUED" ? "Run Now" : "Start Campaign"}
						</Button>
					)}

					{/* Pause Button */}
					{actions.canPause && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setConfirmAction("pause")}
							disabled={isLoading}
						>
							<Pause className="mr-2 h-4 w-4" />
							Pause
						</Button>
					)}

					{/* Resume Button */}
					{actions.canResume && (
						<Button size="sm" onClick={() => setConfirmAction("resume")} disabled={isLoading}>
							<Play className="mr-2 h-4 w-4" />
							Resume
						</Button>
					)}

					{/* Abort Button */}
					{actions.canAbort && (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => setConfirmAction("abort")}
							disabled={isLoading}
						>
							<XCircle className="mr-2 h-4 w-4" />
							Abort
						</Button>
					)}

					{/* Test Email Button */}
					{actions.canTestEmail && (
						<Button variant="outline" size="sm" onClick={() => setShowTestEmailDialog(true)}>
							<Send className="mr-2 h-4 w-4" />
							Send Test
						</Button>
					)}

					{/* Delete Button */}
					{actions.canDelete && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmAction("delete")}
							disabled={isLoading}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			{/* Test Email Dialog */}
			<TestEmailDialog
				open={showTestEmailDialog}
				onOpenChange={setShowTestEmailDialog}
				campaignId={campaign.id}
			/>

			{/* Confirm Status Dialog */}
			{confirmAction && (
				<ConfirmStatusDialog
					open={!!confirmAction}
					onOpenChange={(open) => !open && setConfirmAction(null)}
					action={confirmAction}
					campaignName={campaign.name}
					onConfirm={handleConfirmAction}
					isLoading={isLoading}
				/>
			)}
		</>
	);
}
