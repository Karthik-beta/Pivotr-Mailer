/**
 * New Campaign Page
 *
 * Route for creating a new campaign using the wizard.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Layout } from '@/features/shared/Layout';
import {
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { CampaignWizard } from '@/features/campaigns/components/CampaignWizard';

export const Route = createFileRoute('/_app/campaigns/new')({
    component: NewCampaignPage,
});

function NewCampaignPage() {
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
