/**
 * CampaignLeadsSection Component
 *
 * Display and manage leads for a campaign.
 */

import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Campaign, CampaignMetrics } from "../types";
import { AssignLeadsDialog } from "./AssignLeadsDialog";

interface CampaignLeadsSectionProps {
	campaign: Campaign;
	metrics?: CampaignMetrics;
}

export function CampaignLeadsSection({ campaign, metrics }: CampaignLeadsSectionProps) {
	const [showAssignDialog, setShowAssignDialog] = useState(false);

	const canAssignLeads = ["DRAFT", "QUEUED"].includes(campaign.status);
	const totalLeads = metrics?.totalLeads ?? 0;

	return (
		<div className="space-y-6">
			{/* Lead Selection Criteria */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-mono uppercase">Lead Selection Criteria</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{campaign.leadSelection ? (
						<>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<p className="text-xs font-mono uppercase text-muted-foreground">Lead Types</p>
									<div className="flex flex-wrap gap-2">
										{campaign.leadSelection.leadTypes.length === 0 ? (
											<span className="text-muted-foreground">None selected</span>
										) : (
											campaign.leadSelection.leadTypes.map((type) => (
												<Badge key={type} variant="secondary">
													{type}
												</Badge>
											))
										)}
									</div>
								</div>
								<div className="space-y-2">
									<p className="text-xs font-mono uppercase text-muted-foreground">Lead Statuses</p>
									<div className="flex flex-wrap gap-2">
										{campaign.leadSelection.leadStatuses.length === 0 ? (
											<span className="text-muted-foreground">None selected</span>
										) : (
											campaign.leadSelection.leadStatuses.map((status) => (
												<Badge key={status} variant="secondary">
													{status.replace(/_/g, " ")}
												</Badge>
											))
										)}
									</div>
								</div>
							</div>
							{campaign.leadSelection.maxLeads && (
								<div className="space-y-2">
									<p className="text-xs font-mono uppercase text-muted-foreground">Max Leads</p>
									<p className="font-mono">{campaign.leadSelection.maxLeads.toLocaleString()}</p>
								</div>
							)}
						</>
					) : (
						<p className="text-sm text-muted-foreground">No lead selection criteria configured</p>
					)}
				</CardContent>
			</Card>

			{/* Assigned Leads Summary */}
			<Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center gap-2">
						<Users className="h-5 w-5" />
						Assigned Leads
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
						{totalLeads.toLocaleString()}
					</div>
					<p className="text-sm text-muted-foreground mt-1">leads assigned to this campaign</p>

					{/* Lead breakdown */}
					{metrics && (
						<div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="text-xs text-muted-foreground">Verified</p>
								<p className="font-mono font-medium">{metrics.verified}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Sent</p>
								<p className="font-mono font-medium">{metrics.sent}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Remaining</p>
								<p className="font-mono font-medium">{metrics.remaining}</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Failed</p>
								<p className="font-mono font-medium">{metrics.failed}</p>
							</div>
						</div>
					)}

					{/* Assign More Leads Button */}
					{canAssignLeads && (
						<Button className="mt-4" onClick={() => setShowAssignDialog(true)}>
							<UserPlus className="mr-2 h-4 w-4" />
							Assign More Leads
						</Button>
					)}

					{!canAssignLeads && campaign.status !== "DRAFT" && (
						<p className="text-xs text-muted-foreground mt-4">
							Leads can only be assigned while the campaign is in DRAFT or QUEUED status.
						</p>
					)}
				</CardContent>
			</Card>

			{/* Assign Leads Dialog */}
			<AssignLeadsDialog
				open={showAssignDialog}
				onOpenChange={setShowAssignDialog}
				campaignId={campaign.id}
			/>
		</div>
	);
}
