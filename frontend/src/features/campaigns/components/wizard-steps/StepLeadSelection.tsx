/**
 * StepLeadSelection Component
 *
 * Step 5 of the campaign wizard - Lead selection criteria with preview.
 * Uses TanStack Form for declarative field binding.
 */

import { useStore } from "@tanstack/react-store";
import { RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePreviewLeads } from "../../hooks/useCampaigns";
import type { LeadType } from "../../types";
import type { StepProps } from "../../types/formTypes";

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

export function StepLeadSelection({ form }: StepProps) {
	const previewMutation = usePreviewLeads();

	// Subscribe to lead selection values for display
	const leadSelection = useStore(form.store, (state) => state.values.leadSelection);

	const toggleLeadType = (type: LeadType, checked: boolean) => {
		const currentTypes = leadSelection.leadTypes;
		const newTypes = checked
			? [...currentTypes, type]
			: currentTypes.filter((t) => t !== type);

		form.setFieldValue("leadSelection.leadTypes", newTypes);
	};

	const toggleStatus = (status: string, checked: boolean) => {
		const currentStatuses = leadSelection.statuses;
		const newStatuses = checked
			? [...currentStatuses, status]
			: currentStatuses.filter((s) => s !== status);

		form.setFieldValue("leadSelection.statuses", newStatuses);
	};

	// Fetch preview count when selection changes
	const refreshPreview = useCallback(() => {
		if (leadSelection.leadTypes.length > 0 && leadSelection.statuses.length > 0) {
			previewMutation.mutate({
				leadTypes: leadSelection.leadTypes,
				statuses: leadSelection.statuses,
				maxLeads: leadSelection.maxLeads,
			});
		}
	}, [
		leadSelection.leadTypes,
		leadSelection.statuses,
		leadSelection.maxLeads,
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
								checked={leadSelection.leadTypes.includes(value)}
								onCheckedChange={(checked) => toggleLeadType(value, checked as boolean)}
							/>
							<Label htmlFor={`type-${value}`} className="cursor-pointer">
								{label}
							</Label>
						</div>
					))}
				</div>
				<form.Field name="leadSelection.leadTypes">
					{(field) =>
						field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
						)
					}
				</form.Field>
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
								checked={leadSelection.statuses.includes(value)}
								onCheckedChange={(checked) => toggleStatus(value, checked as boolean)}
							/>
							<Label htmlFor={`status-${value}`} className="cursor-pointer">
								{label}
							</Label>
						</div>
					))}
				</div>
				<form.Field name="leadSelection.statuses">
					{(field) =>
						field.state.meta.errors.length > 0 && (
							<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
						)
					}
				</form.Field>
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
					) : leadSelection.leadTypes.length === 0 ||
						leadSelection.statuses.length === 0 ? (
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
							leadSelection.leadTypes.length === 0 ||
							leadSelection.statuses.length === 0
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
