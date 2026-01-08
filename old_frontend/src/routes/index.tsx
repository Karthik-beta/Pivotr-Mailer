import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import { CampaignStatus } from "@shared/constants/status.constants";
import type { Campaign } from "@shared/types/campaign.types";
import type { Log } from "@shared/types/log.types";
import { createFileRoute } from "@tanstack/react-router";
import { Query } from "appwrite";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, Database, Mail, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignControls } from "@/features/dashboard/components/campaign-controls";
import { DashboardConsole } from "@/features/dashboard/components/dashboard-console";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { databases } from "@/lib/appwrite";
import { campaignKeys, logsKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/")({
	component: Dashboard,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData({
				queryKey: campaignKeys.active(),
				queryFn: async () => {
					const response = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
						Query.orderDesc("$createdAt"),
						Query.limit(1),
					]);
					return response.documents.length > 0
						? (response.documents[0] as unknown as Campaign)
						: null;
				},
				staleTime: 1000 * 60,
			}),
			queryClient.ensureQueryData({
				queryKey: logsKeys.recent(),
				queryFn: async () => {
					const response = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
						Query.orderDesc("$createdAt"),
						Query.limit(50),
					]);
					return (response.documents as unknown as Log[]).reverse();
				},
				staleTime: 1000 * 60,
			}),
		]);
	},
	pendingComponent: DashboardSkeleton,
});

function Dashboard() {
	const { activeCampaign, recentLogs, updateCampaignStatus } = useDashboard();

	// Derived Stats
	const sentCount = activeCampaign?.processedCount || 0;
	const errorCount = activeCampaign?.errorCount || 0;
	const skippedCount = activeCampaign?.skippedCount || 0; // Filtered/Invalid
	const totalLeads = activeCampaign?.totalLeads || 0;

	// Example calculation for Queue: Total - (Sent + Error + Skipped)
	// If campaign is fresh, Queue = Total.
	const processedTotal = sentCount + errorCount + skippedCount;
	const queueCount = Math.max(0, totalLeads - processedTotal);

	// Delivery Rate (Sent / Processed)
	const deliveryRate = processedTotal > 0 ? Math.round((sentCount / processedTotal) * 100) : 0;

	return (
		<div className="p-6 space-y-6 max-w-[1600px] mx-auto">
			{/* Header Area */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
					<p className="text-muted-foreground mt-1">
						{activeCampaign ? (
							<>
								Active Campaign:{" "}
								<span className="font-medium text-foreground">{activeCampaign.name}</span>
							</>
						) : (
							"No active campaigns found."
						)}
					</p>
				</div>

				{/* Campaign Controls */}
				{activeCampaign && (
					<div className="flex items-center gap-4 bg-card border rounded-lg p-2 shadow-sm">
						<div className="px-2 text-sm font-medium border-r pr-4 mr-2">
							Status: <StatusBadge status={activeCampaign.status} />
						</div>
						<CampaignControls status={activeCampaign.status} onAction={updateCampaignStatus} />
					</div>
				)}
			</div>

			{/* KPI Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					label="Delivered"
					value={sentCount}
					icon={CheckCircle}
					subtext={`${deliveryRate}% Success Rate`}
					trend="up"
				/>
				<MetricCard
					label="Queued"
					value={queueCount}
					icon={Clock}
					subtext="Remaining in pipeline"
				/>
				<MetricCard
					label="Skipped / Invalid"
					value={skippedCount}
					icon={AlertTriangle}
					color="text-yellow-500"
					subtext="Filtered by verification"
				/>
				<MetricCard
					label="Errors"
					value={errorCount}
					icon={Zap}
					color="text-red-500"
					subtext="Failed attempts"
				/>
			</div>

			{/* Main Content Area */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Left Column: Details (Expandable in future) */}
				<div className="space-y-6">
					<div className="bg-card border rounded-xl p-6 shadow-sm">
						<h3 className="font-semibold mb-4 flex items-center gap-2">
							<Mail className="h-4 w-4" /> Campaign Details
						</h3>
						{activeCampaign ? (
							<div className="space-y-4 text-sm">
								<div className="flex justify-between py-2 border-b">
									<span className="text-muted-foreground">Sender</span>
									<span className="font-mono">{activeCampaign.senderEmail}</span>
								</div>
								<div className="flex justify-between py-2 border-b">
									<span className="text-muted-foreground">Subject Template</span>
									<span className="truncate max-w-[200px]" title={activeCampaign.subjectTemplate}>
										{activeCampaign.subjectTemplate}
									</span>
								</div>
								<div className="flex justify-between py-2 border-b">
									<span className="text-muted-foreground">Created</span>
									<span>{format(new Date(activeCampaign.$createdAt), "PP p")}</span>
								</div>
								<div className="flex justify-between py-2 border-b">
									<span className="text-muted-foreground">Last Activity</span>
									<span>
										{activeCampaign.lastActivityAt
											? format(new Date(activeCampaign.lastActivityAt), "p")
											: "-"}
									</span>
								</div>
							</div>
						) : (
							<div className="text-muted-foreground text-sm italic">
								Select or create a campaign to view details.
							</div>
						)}
					</div>

					{/* System Status / Database Info */}
					<div className="bg-card border rounded-xl p-6 shadow-sm">
						<h3 className="font-semibold mb-4 flex items-center gap-2">
							<Database className="h-4 w-4" /> System Health
						</h3>
						<div className="space-y-2 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full bg-green-500" />
								<span>Database Connected</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 rounded-full bg-green-500" />
								<span>Realtime Stream Active</span>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column: Console (Spans 2 cols) */}
				<div className="lg:col-span-2 space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-lg">Live Operation Log</h3>
						<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
							Streaming via WebSocket
						</span>
					</div>
					<DashboardConsole logs={recentLogs} />
				</div>
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	let colorClass = "bg-slate-100 text-slate-800";
	if (status === CampaignStatus.RUNNING)
		colorClass = "bg-green-100 text-green-800 border-green-200 animate-pulse";
	if (status === CampaignStatus.PAUSED)
		colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
	if (status === CampaignStatus.COMPLETED) colorClass = "bg-blue-100 text-blue-800 border-blue-200";
	if (status === CampaignStatus.ERROR) colorClass = "bg-red-100 text-red-800 border-red-200";

	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
		>
			{status}
		</span>
	);
}

function DashboardSkeleton() {
	return (
		<div className="p-6 space-y-6">
			<div className="flex justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-32" />
				</div>
				<Skeleton className="h-10 w-64" />
			</div>
			<div className="grid gap-4 md:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Skeleton key={`skeleton-${i}`} className="h-32 w-full" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<Skeleton className="h-[400px]" />
				<Skeleton className="h-[400px] lg:col-span-2" />
			</div>
		</div>
	);
}
