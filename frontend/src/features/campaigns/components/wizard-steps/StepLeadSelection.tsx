/**
 * StepLeadSelection Component
 *
 * Step 5 of the campaign wizard - Lead selection criteria with preview.
 */

import { RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePreviewLeads } from "../../hooks/useCampaigns";
import type { LeadType } from "../../types";
import type { CampaignFormData } from "../CampaignWizard";

interface StepLeadSelectionProps {
	data: CampaignFormData;
	onChange: (data: Partial<CampaignFormData>) => void;
	errors: Record<string, string>;
}

const LEAD_TYPES: { value: LeadType; label: string }[] = [
	{ value: "HARDWARE", label: "Hardware" },
	{ value: "SOFTWARE", label: "Software" },
	{ value: "BOTH", label: "Both" },
];

const LEAD_STATUSES = [
	{ value: "PENDING_IMPORT", label: "Pending Import" },
	{ value: "VERIFIED", label: "Verified" },
	{ value: "RISKY", label: "Risky" },
];

export function StepLeadSelection({ data, onChange, errors }: StepLeadSelectionProps) {
	const previewMutation = usePreviewLeads();

	const toggleLeadType = (type: LeadType, checked: boolean) => {
		const newTypes = checked
			? [...data.leadSelection.leadTypes, type]
			: data.leadSelection.leadTypes.filter((t) => t !== type);

		onChange({
			leadSelection: {
				...data.leadSelection,
				leadTypes: newTypes,
			},
		});
	};

	const toggleStatus = (status: string, checked: boolean) => {
		const newStatuses = checked
			? [...data.leadSelection.statuses, status]
			: data.leadSelection.statuses.filter((s) => s !== status);

		onChange({
			leadSelection: {
				...data.leadSelection,
				statuses: newStatuses,
			},
		});
	};

	// Fetch preview count when selection changes
	const refreshPreview = useCallback(() => {
		if (data.leadSelection.leadTypes.length > 0 && data.leadSelection.statuses.length > 0) {
			previewMutation.mutate({
				leadTypes: data.leadSelection.leadTypes,
				statuses: data.leadSelection.statuses,
				maxLeads: data.leadSelection.maxLeads,
			});
		}
	}, [
		data.leadSelection.leadTypes,
		data.leadSelection.statuses,
		data.leadSelection.maxLeads,
		previewMutation,
	]);

	// Auto-refresh on selection change (debounced)
	useEffect(() => {
		const timer = setTimeout(() => {
			refreshPreview();
		}, 500);
		return () => clearTimeout(timer);
	}, [refreshPreview]);

	const previewCount = previewMutation.data?.data?.count ?? 0;
	const isLoading = previewMutation.isPending;

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				Select the criteria for leads to include in this campaign. Only leads matching all selected
				criteria will be targeted.
			</p>

			{/* Lead Types */}
			<div className="space-y-3">
				<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					Lead Types *
				</Label>
				<div className="flex flex-wrap gap-4">
					{LEAD_TYPES.map(({ value, label }) => (
						<div key={value} className="flex items-center gap-2">
							<Checkbox
								id={`type-${value}`}
								checked={data.leadSelection.leadTypes.includes(value)}
								onCheckedChange={(checked) => toggleLeadType(value, checked as boolean)}
							/>
							<Label htmlFor={`type-${value}`} className="cursor-pointer">
								{label}
							</Label>
						</div>
					))}
				</div>
				{errors["leadSelection.leadTypes"] && (
					<p className="text-sm text-destructive">{errors["leadSelection.leadTypes"]}</p>
				)}
			</div>

			{/* Lead Statuses */}
			<div className="space-y-3">
				<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
					Lead Statuses *
				</Label>
				<div className="flex flex-wrap gap-4">
					{LEAD_STATUSES.map(({ value, label }) => (
						<div key={value} className="flex items-center gap-2">
							<Checkbox
								id={`status-${value}`}
								checked={data.leadSelection.statuses.includes(value)}
								onCheckedChange={(checked) => toggleStatus(value, checked as boolean)}
							/>
							<Label htmlFor={`status-${value}`} className="cursor-pointer">
								{label}
							</Label>
						</div>
					))}
				</div>
				{errors["leadSelection.statuses"] && (
					<p className="text-sm text-destructive">{errors["leadSelection.statuses"]}</p>
				)}
			</div>

			{/* Lead Preview */}
			<Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg flex items-center gap-2">
						<Users className="h-5 w-5" />
						Matching Leads
					</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center gap-2">
							<RefreshCw className="h-4 w-4 animate-spin" />
							<span className="text-sm text-muted-foreground">Counting leads...</span>
						</div>
					) : data.leadSelection.leadTypes.length === 0 ||
						data.leadSelection.statuses.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Select at least one lead type and status to see matching leads
						</p>
					) : (
						<>
							<div className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
								{previewCount.toLocaleString()}
							</div>
							<p className="text-sm text-muted-foreground mt-1">leads match your criteria</p>
						</>
					)}
					<Button
						variant="outline"
						size="sm"
						className="mt-4"
						onClick={refreshPreview}
						disabled={
							isLoading ||
							data.leadSelection.leadTypes.length === 0 ||
							data.leadSelection.statuses.length === 0
						}
					>
						<RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
						Refresh Count
					</Button>
				</CardContent>
			</Card>

			{/* Sample Leads Preview */}
			{previewMutation.data?.data?.sample && previewMutation.data.data.sample.length > 0 && (
				<div className="space-y-2">
					<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
						Sample Leads
					</Label>
					<div className="rounded-lg border overflow-hidden">
						<table className="w-full text-sm">
							<thead className="bg-muted">
								<tr>
									<th className="px-4 py-2 text-left font-mono text-xs">Name</th>
									<th className="px-4 py-2 text-left font-mono text-xs">Company</th>
									<th className="px-4 py-2 text-left font-mono text-xs">Type</th>
									<th className="px-4 py-2 text-left font-mono text-xs">Status</th>
								</tr>
							</thead>
							<tbody>
								{previewMutation.data.data.sample.slice(0, 5).map((lead) => (
									<tr key={lead.id} className="border-t">
										<td className="px-4 py-2">{lead.fullName}</td>
										<td className="px-4 py-2">{lead.companyName}</td>
										<td className="px-4 py-2 font-mono text-xs">{lead.type}</td>
										<td className="px-4 py-2 font-mono text-xs">{lead.status}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
