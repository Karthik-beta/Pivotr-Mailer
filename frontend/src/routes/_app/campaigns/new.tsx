/**
 * New Campaign Page
 *
 * Route for creating a new campaign using the wizard.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CampaignWizard } from "@/features/campaigns/components/CampaignWizard";
import { Layout } from "@/features/shared/Layout";

export const Route = createFileRoute("/_app/campaigns/new")({
	component: NewCampaignPage,
});

function NewCampaignPage() {
	return (
		<Layout
			breadcrumbs={
				<>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink asChild>
							<Link to="/">Pivotr Mailer</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/campaigns" search={{ status: "all" }} preload="intent">
								Campaigns
							</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator className="hidden md:block" />
					<BreadcrumbItem>
						<BreadcrumbPage>New Campaign</BreadcrumbPage>
					</BreadcrumbItem>
				</>
			}
		>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Create Campaign</h1>
					<p className="text-muted-foreground">
						Configure your email campaign with Gaussian scheduling.
					</p>
				</div>

				{/* Wizard */}
				<CampaignWizard mode="create" />
			</div>
		</Layout>
	);
}
