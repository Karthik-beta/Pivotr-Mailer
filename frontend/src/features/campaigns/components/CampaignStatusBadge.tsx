/**
 * Campaign Status Badge Component
 *
 * Displays a styled badge for campaign statuses.
 */

import { cn } from "@/lib/utils";
import type { CampaignStatus } from "../types";

interface CampaignStatusBadgeProps {
	status: CampaignStatus;
	className?: string;
}

const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
	DRAFT: {
		label: "Draft",
		className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
	},
	QUEUED: {
		label: "Queued",
		className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	},
	RUNNING: {
		label: "Running",
		className:
			"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 animate-pulse",
	},
	PAUSED: {
		label: "Paused",
		className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	},
	COMPLETED: {
		label: "Completed",
		className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	},
	ABORTED: {
		label: "Aborted",
		className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
	},
};

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
	const config = statusConfig[status] || {
		label: status,
		className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
	};

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
				config.className,
				className
			)}
		>
			{config.label}
		</span>
	);
}
