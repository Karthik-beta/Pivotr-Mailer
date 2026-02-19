/**
 * Campaign Detail Page
 *
 * Route for viewing and managing a specific campaign.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw, XCircle } from "lucide-react";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { CampaignDetail } from "@/features/campaigns/components/CampaignDetail";
import { CampaignDetailSkeleton } from "@/features/campaigns/components/CampaignDetailSkeleton";
import {
	campaignQueryOptions,
	useCampaign,
	useCampaignMetrics,
} from "@/features/campaigns/hooks/useCampaigns";
import { Layout } from "@/features/shared/Layout";

export const Route = createFileRoute("/_app/campaigns/$id")({
	component: CampaignDetailPage,
	loader: ({ context, params }) => {
		const queryOpts = campaignQueryOptions(params.id);
		if (context.queryClient.getQueryData(queryOpts.queryKey)) {
			void context.queryClient.prefetchQuery(queryOpts);
			return;
		}
		return context.queryClient.prefetchQuery(queryOpts);
	},
});

function CampaignDetailPage() {
	const { id } = Route.useParams();
	const { data: campaignData, isLoading, error, refetch } = useCampaign(id);
	const { data: metricsData } = useCampaignMetrics(id);

	const campaign = campaignData?.data;
	const metrics = metricsData?.data;

	// Loading state
	if (isLoading) {
		return (
			<Layout
				breadcrumbs={
					<>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href="/campaigns">Campaigns</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Loading...</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				}
			>
				<CampaignDetailSkeleton />
			</Layout>
		);
	}

	// Error state
	if (error) {
		return (
			<Layout
				breadcrumbs={
					<>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href="/campaigns">Campaigns</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Error</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				}
			>
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<XCircle className="h-12 w-12 text-red-500 mb-4" />
					<h2 className="text-xl font-semibold mb-2">Failed to load campaign</h2>
					<p className="text-muted-foreground mb-4">
						{error instanceof Error ? error.message : "An unknown error occurred"}
					</p>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => refetch()}>
							<RefreshCw className="mr-2 h-4 w-4" />
							Retry
						</Button>
						<Button asChild>
							<Link to="/campaigns" search={{ status: "all" }}>
								Back to Campaigns
							</Link>
						</Button>
					</div>
				</div>
			</Layout>
		);
	}

	// Not found state
	if (!campaign) {
		return (
			<Layout
				breadcrumbs={
					<>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href="/campaigns">Campaigns</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Not Found</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				}
			>
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<XCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
					<h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
					<p className="text-muted-foreground mb-4">
						The campaign you're looking for doesn't exist or has been deleted.
					</p>
					<Button asChild>
						<Link to="/campaigns" search={{ status: "all" }}>
							Back to Campaigns
						</Link>
					</Button>
				</div>
			</Layout>
		);
	}

	return (
		<Layout
			breadcrumbs={
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink href="/">Pivotr Mailer</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbLink href="/campaigns">Campaigns</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>{campaign.name}</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			}
		>
			<CampaignDetail campaign={campaign} metrics={metrics} />
		</Layout>
	);
}
