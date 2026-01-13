/**
 * StepReview Component
 *
 * Step 6 of the campaign wizard - Final review before creation.
 */

import { format } from "date-fns";
import { AlertTriangle, Calendar, Clock, FileText, Mail, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignFormData } from "../CampaignWizard";

interface StepReviewProps {
	data: CampaignFormData;
	matchingLeadsCount: number;
}

/**
 * Format milliseconds to human-readable string
 */
function formatDelay(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (remainingSeconds === 0) {
		return `${minutes}m`;
	}
	return `${minutes}m ${remainingSeconds}s`;
}

export function StepReview({ data, matchingLeadsCount }: StepReviewProps) {
	// Generate validation warnings
	const warnings: string[] = [];

	if (matchingLeadsCount === 0) {
		warnings.push("No leads match your selection criteria. Consider adjusting the filters.");
	}

	if (data.schedule.scheduledDates.length === 0) {
		warnings.push("No scheduled dates selected. The campaign won't run without dates.");
	}

	if (data.schedule.dailyLimit < 10) {
		warnings.push("Daily limit is very low. Consider increasing it for efficiency.");
	}

	if (data.delayConfig.minDelayMs < 10000) {
		warnings.push(
			"Very short delay times may affect email deliverability. Consider increasing the minimum delay."
		);
	}

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				Review your campaign settings before creating. You can edit these later while the campaign
				is in DRAFT status.
			</p>

			{/* Summary cards in grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Basic Info Summary */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
							<FileText className="h-4 w-4" />
							Basic Info
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div>
							<span className="text-xs text-muted-foreground">Name:</span>
							<p className="font-medium">{data.name}</p>
						</div>
						<div>
							<span className="text-xs text-muted-foreground">Description:</span>
							<p className="text-sm">{data.description || "No description"}</p>
						</div>
					</CardContent>
				</Card>

				{/* Template Summary */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
							<Mail className="h-4 w-4" />
							Email Template
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div>
							<span className="text-xs text-muted-foreground">From:</span>
							<p className="text-sm">
								{data.template.senderName} &lt;{data.template.senderEmail}&gt;
							</p>
						</div>
						<div>
							<span className="text-xs text-muted-foreground">Subject:</span>
							<p className="font-medium truncate">{data.template.subject}</p>
						</div>
						{data.template.ccEmail && (
							<div>
								<span className="text-xs text-muted-foreground">CC:</span>
								<p className="text-sm">{data.template.ccEmail}</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Schedule Summary */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							Schedule
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Working Hours:</span>
							<span className="text-sm font-mono">
								{data.schedule.workingHours.startHour.toString().padStart(2, "0")}:
								{data.schedule.workingHours.startMinute.toString().padStart(2, "0")} -{" "}
								{data.schedule.workingHours.endHour.toString().padStart(2, "0")}:
								{data.schedule.workingHours.endMinute.toString().padStart(2, "0")}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Scheduled Dates:</span>
							<span className="text-sm">{data.schedule.scheduledDates.length} days</span>
						</div>
						{data.schedule.scheduledDates.length > 0 && (
							<div className="text-xs text-muted-foreground">
								{data.schedule.scheduledDates
									.slice(0, 3)
									.map((d) => format(d, "MMM d"))
									.join(", ")}
								{data.schedule.scheduledDates.length > 3 && "..."}
							</div>
						)}
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Daily Limit:</span>
							<span className="text-sm font-mono">{data.schedule.dailyLimit}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Timezone:</span>
							<span className="text-sm">{data.schedule.timezone}</span>
						</div>
					</CardContent>
				</Card>

				{/* Delay Config Summary */}
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
							<Clock className="h-4 w-4" />
							Delay Config
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Min Delay:</span>
							<span className="text-sm font-mono">{formatDelay(data.delayConfig.minDelayMs)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Max Delay:</span>
							<span className="text-sm font-mono">{formatDelay(data.delayConfig.maxDelayMs)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-xs text-muted-foreground">Gaussian:</span>
							<span className="text-sm">
								{data.delayConfig.gaussianEnabled ? "Enabled" : "Disabled"}
							</span>
						</div>
					</CardContent>
				</Card>

				{/* Leads Summary */}
				<Card className="md:col-span-2 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-mono uppercase flex items-center gap-2">
							<Users className="h-4 w-4" />
							Target Leads
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
							{matchingLeadsCount.toLocaleString()}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{data.leadSelection.leadTypes.join(", ")} | {data.leadSelection.statuses.join(", ")}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Validation warnings */}
			{warnings.length > 0 && (
				<Alert variant="default">
					<AlertTriangle className="h-4 w-4" />
					<AlertTitle>Review Required</AlertTitle>
					<AlertDescription>
						<ul className="list-disc list-inside mt-2 space-y-1">
							{warnings.map((warning, i) => (
								<li key={i}>{warning}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
