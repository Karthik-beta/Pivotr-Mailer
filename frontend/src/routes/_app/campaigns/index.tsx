/**
 * Campaigns List Page
 *
 * Main campaigns management page with data table.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	CheckCircle2,
	Clock,
	Mail,
	Play,
	Plus,
	RefreshCw,
	Users,
	XCircle,
} from "lucide-react";
import { z } from "zod";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/features/campaigns/components/CampaignStatusBadge";
import { useCampaigns } from "@/features/campaigns/hooks/useCampaigns";
import type { Campaign } from "@/features/campaigns/types";
import { Layout } from "@/features/shared/Layout";

// Search params schema
const campaignsSearchSchema = z.object({
	status: z.string().catch("all"),
});

export const Route = createFileRoute("/_app/campaigns/")({
	component: CampaignsPage,
	validateSearch: campaignsSearchSchema,
});

function CampaignsPage() {
	const navigate = useNavigate();
	const { status } = Route.useSearch();
	const { data, isLoading, error, refetch, isRefetching } = useCampaigns(
		status !== "all" ? { status } : undefined
	);

	const campaigns = data?.data || [];

	// Calculate stats
	const stats = {
		total: campaigns.length,
		running: campaigns.filter((c) => c.status === "RUNNING").length,
		completed: campaigns.filter((c) => c.status === "COMPLETED").length,
		draft: campaigns.filter((c) => c.status === "DRAFT").length,
	};

	const handleCampaignClick = (campaign: Campaign) => {
		navigate({ to: "/campaigns/$id", params: { id: campaign.id } });
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
						<BreadcrumbPage>Campaigns</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			}
		>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
						<p className="text-muted-foreground">
							Manage your email campaigns with Gaussian scheduling.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
							<RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
							Refresh
						</Button>
						<Button size="sm" asChild>
							<Link to="/campaigns/new">
								<Plus className="mr-2 h-4 w-4" />
								New Campaign
							</Link>
						</Button>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
							<Mail className="h-4 w-4 text-slate-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">All campaigns</p>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Running</CardTitle>
							<Play className="h-4 w-4 text-emerald-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
								{stats.running}
							</div>
							<p className="text-xs text-emerald-600/70">Active campaigns</p>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Completed</CardTitle>
							<CheckCircle2 className="h-4 w-4 text-green-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-700 dark:text-green-400">
								{stats.completed}
							</div>
							<p className="text-xs text-green-600/70">Successfully finished</p>
						</CardContent>
					</Card>

					<Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Draft</CardTitle>
							<Clock className="h-4 w-4 text-amber-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
								{stats.draft}
							</div>
							<p className="text-xs text-amber-600/70">Not yet started</p>
						</CardContent>
					</Card>
				</div>

				{/* Campaigns List */}
				<Card>
					<CardHeader>
						<CardTitle>All Campaigns</CardTitle>
						<CardDescription>Click on a campaign to view details and manage it.</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="flex items-center justify-center py-8">
								<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : error ? (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<XCircle className="h-8 w-8 text-red-500 mb-2" />
								<p className="text-muted-foreground">Failed to load campaigns</p>
								<Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
									Retry
								</Button>
							</div>
						) : campaigns.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<Mail className="h-12 w-12 text-muted-foreground/50 mb-4" />
								<h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
								<p className="text-muted-foreground mb-4">
									Create your first email campaign to get started.
								</p>
								<Button asChild>
									<Link to="/campaigns/new">
										<Plus className="mr-2 h-4 w-4" />
										Create Campaign
									</Link>
								</Button>
							</div>
						) : (
							<div className="space-y-4">
								{campaigns.map((campaign) => (
									<button
										type="button"
										key={campaign.id}
										className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors text-left"
										onClick={() => handleCampaignClick(campaign)}
									>
										<div className="flex items-center gap-4">
											<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
												<Mail className="h-5 w-5 text-primary" />
											</div>
											<div>
												<h4 className="font-medium">{campaign.name}</h4>
												<p className="text-sm text-muted-foreground">
													{campaign.description || "No description"}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-4">
											{campaign.metrics && (
												<div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
													<span className="flex items-center gap-1">
														<Users className="h-4 w-4" />
														{campaign.metrics.totalLeads}
													</span>
													<span className="flex items-center gap-1">
														<CheckCircle2 className="h-4 w-4 text-emerald-500" />
														{campaign.metrics.sent}
													</span>
													<span className="flex items-center gap-1">
														<BarChart3 className="h-4 w-4 text-blue-500" />
														{campaign.metrics.opened}
													</span>
												</div>
											)}
											<CampaignStatusBadge status={campaign.status} />
										</div>
									</button>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}
