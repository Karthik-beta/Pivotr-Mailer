/**
 * Edit Campaign Page
 *
 * Route for editing a campaign (DRAFT status only).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { CampaignDetailSkeleton } from "@/features/campaigns/components/CampaignDetailSkeleton";
import { CampaignWizard } from "@/features/campaigns/components/CampaignWizard";
import { useCampaign } from "@/features/campaigns/hooks/useCampaigns";
import { Layout } from "@/features/shared/Layout";

export const Route = createFileRoute("/_app/campaigns/$id/edit")({
	component: EditCampaignPage,
});

function EditCampaignPage() {
	const { id } = Route.useParams();
	const { data: campaignData, isLoading, error, refetch } = useCampaign(id);

	const campaign = campaignData?.data;

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

	// Not editable state (not DRAFT)
	if (campaign.status !== "DRAFT") {
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
							<BreadcrumbLink href={`/campaigns/${id}`}>{campaign.name}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Edit</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				}
			>
				<div className="space-y-6">
					<Alert variant="destructive">
						<AlertTriangle className="h-4 w-4" />
						<AlertTitle>Cannot Edit Campaign</AlertTitle>
						<AlertDescription>
							This campaign is in <strong>{campaign.status}</strong> status and cannot be edited.
							Only campaigns in DRAFT status can be modified.
						</AlertDescription>
					</Alert>
					<Button asChild>
						<Link to="/campaigns/$id" params={{ id }}>
							View Campaign
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
						<BreadcrumbLink href={`/campaigns/${id}`}>{campaign.name}</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>Edit</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			}
		>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
					<p className="text-muted-foreground">
						Modify your campaign settings. Changes can only be made while in DRAFT status.
					</p>
				</div>

				{/* Wizard */}
				<CampaignWizard mode="edit" campaign={campaign} />
			</div>
		</Layout>
	);
}
