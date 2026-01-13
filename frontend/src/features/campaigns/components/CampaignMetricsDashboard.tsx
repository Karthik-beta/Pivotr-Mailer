/**
 * CampaignMetricsDashboard Component
 *
 * Real-time metrics display for campaign detail page.
 */

import {
	AlertTriangle,
	CheckCircle2,
	Eye,
	Flag,
	MousePointerClick,
	RefreshCw,
	Send,
	SkipForward,
	Users,
	XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCampaignMetrics } from "../hooks/useCampaigns";
import type { Campaign } from "../types";
import { MetricCard } from "./MetricCard";

interface CampaignMetricsDashboardProps {
	campaign: Campaign;
}

export function CampaignMetricsDashboard({ campaign }: CampaignMetricsDashboardProps) {
	const { data, isLoading, isRefetching } = useCampaignMetrics(campaign.id);
	const metrics = data?.data;

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!metrics) {
		return <div className="text-center py-12 text-muted-foreground">No metrics available yet</div>;
	}

	const progressPercentage =
		metrics.totalLeads > 0 ? Math.round((metrics.sent / metrics.totalLeads) * 100) : 0;

	return (
		<div className="space-y-6">
			{/* Progress bar for running campaigns */}
			{campaign.status === "RUNNING" && (
				<Card className="p-4">
					<div className="flex justify-between text-sm mb-2">
						<span className="flex items-center gap-2">
							Progress
							{isRefetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
						</span>
						<span className="font-mono">
							{metrics.sent} / {metrics.totalLeads} ({progressPercentage}%)
						</span>
					</div>
					<div className="h-2 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary transition-all duration-500"
							style={{ width: `${progressPercentage}%` }}
						/>
					</div>
				</Card>
			)}

			{/* Primary metrics - 4 columns */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<MetricCard title="Total Leads" value={metrics.totalLeads} icon={Users} gradient="slate" />
				<MetricCard
					title="Sent"
					value={metrics.sent}
					icon={Send}
					gradient="emerald"
					subValue={`${metrics.remaining} remaining`}
				/>
				<MetricCard
					title="Delivered"
					value={metrics.delivered}
					icon={CheckCircle2}
					gradient="green"
					percentage={metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0}
				/>
				<MetricCard
					title="Opened"
					value={metrics.opened}
					icon={Eye}
					gradient="blue"
					percentage={metrics.delivered > 0 ? (metrics.opened / metrics.delivered) * 100 : 0}
				/>
			</div>

			{/* Secondary metrics - 6 columns */}
			<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
				<MetricCard
					title="Clicked"
					value={metrics.clicked}
					icon={MousePointerClick}
					gradient="purple"
					size="sm"
				/>
				<MetricCard
					title="Bounced"
					value={metrics.bounced}
					icon={AlertTriangle}
					gradient="amber"
					size="sm"
				/>
				<MetricCard
					title="Complained"
					value={metrics.complained}
					icon={Flag}
					gradient="red"
					size="sm"
				/>
				<MetricCard
					title="Verified"
					value={metrics.verified}
					icon={CheckCircle2}
					gradient="emerald"
					size="sm"
				/>
				<MetricCard
					title="Remaining"
					value={metrics.remaining}
					icon={SkipForward}
					gradient="slate"
					size="sm"
				/>
				<MetricCard title="Failed" value={metrics.failed} icon={XCircle} gradient="red" size="sm" />
			</div>

			{/* Auto-refresh indicator */}
			<p className="text-xs text-muted-foreground text-center">
				Metrics refresh automatically every 30 seconds
			</p>
		</div>
	);
}
