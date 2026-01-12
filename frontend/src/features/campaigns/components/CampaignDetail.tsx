/**
 * CampaignDetail Component
 *
 * Main component for the campaign detail page with tabs.
 */

import { Users, Send, CheckCircle2, Eye } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CampaignHeader } from './CampaignHeader';
import { CampaignMetricsDashboard } from './CampaignMetricsDashboard';
import { CampaignTemplatePreview } from './CampaignTemplatePreview';
import { CampaignScheduleInfo } from './CampaignScheduleInfo';
import { CampaignLeadsSection } from './CampaignLeadsSection';
import { MetricCard } from './MetricCard';
import type { Campaign, CampaignMetrics } from '../types';

interface CampaignDetailProps {
    campaign: Campaign;
    metrics?: CampaignMetrics;
}

export function CampaignDetail({ campaign, metrics }: CampaignDetailProps) {
    return (
        <div className="space-y-6">
            {/* Header with status and actions */}
            <CampaignHeader campaign={campaign} />

            {/* Tab navigation */}
            <Tabs defaultValue="overview">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="template">Template</TabsTrigger>
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6 mt-6">
                    {/* Quick stats */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <MetricCard
                            title="Total Leads"
                            value={metrics?.totalLeads ?? 0}
                            icon={Users}
                            gradient="slate"
                        />
                        <MetricCard
                            title="Sent"
                            value={metrics?.sent ?? 0}
                            icon={Send}
                            gradient="emerald"
                            subValue={`${metrics?.remaining ?? 0} remaining`}
                        />
                        <MetricCard
                            title="Delivered"
                            value={metrics?.delivered ?? 0}
                            icon={CheckCircle2}
                            gradient="green"
                            percentage={
                                metrics && metrics.sent > 0
                                    ? (metrics.delivered / metrics.sent) * 100
                                    : 0
                            }
                        />
                        <MetricCard
                            title="Opened"
                            value={metrics?.opened ?? 0}
                            icon={Eye}
                            gradient="blue"
                            percentage={
                                metrics && metrics.delivered > 0
                                    ? (metrics.opened / metrics.delivered) * 100
                                    : 0
                            }
                        />
                    </div>

                    {/* Campaign Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Template Preview */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-mono uppercase">
                                    Email Template
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {campaign.template ? (
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Subject:</p>
                                            <p className="font-medium truncate">
                                                {campaign.template.subject}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">From:</p>
                                            <p className="text-sm">
                                                {campaign.template.senderName} &lt;
                                                {campaign.template.senderEmail}&gt;
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No template configured
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Delay Config */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-mono uppercase">
                                    Delay Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {campaign.delayConfig ? (
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Min Delay</p>
                                            <p className="font-mono font-medium">
                                                {Math.round(campaign.delayConfig.minDelayMs / 1000)}s
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Max Delay</p>
                                            <p className="font-mono font-medium">
                                                {Math.round(campaign.delayConfig.maxDelayMs / 1000)}s
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Gaussian</p>
                                            <p className="font-medium">
                                                {campaign.delayConfig.gaussianEnabled ? 'Yes' : 'No'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No delay configuration
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics" className="mt-6">
                    <CampaignMetricsDashboard campaign={campaign} />
                </TabsContent>

                {/* Template Tab */}
                <TabsContent value="template" className="mt-6">
                    {campaign.template ? (
                        <CampaignTemplatePreview template={campaign.template} />
                    ) : (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground">
                                    No email template configured for this campaign.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Leads Tab */}
                <TabsContent value="leads" className="mt-6">
                    <CampaignLeadsSection campaign={campaign} metrics={metrics} />
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="mt-6">
                    {campaign.schedule ? (
                        <CampaignScheduleInfo schedule={campaign.schedule} />
                    ) : (
                        <Card>
                            <CardContent className="py-8 text-center">
                                <p className="text-muted-foreground">
                                    No schedule configured for this campaign.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
