/**
 * CampaignDetailSkeleton Component
 *
 * Loading skeleton for campaign detail page.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CampaignDetailSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="flex items-start gap-4">
				<Skeleton className="h-12 w-12 rounded-lg" />
				<div className="space-y-2 flex-1">
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-64" />
						<Skeleton className="h-6 w-20" />
					</div>
					<Skeleton className="h-4 w-96" />
					<Skeleton className="h-3 w-48" />
				</div>
			</div>

			{/* Tabs skeleton */}
			<Skeleton className="h-10 w-96" />

			{/* Metrics skeleton */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-2">
							<Skeleton className="h-4 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-20" />
							<Skeleton className="h-3 w-16 mt-2" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Secondary metrics skeleton */}
			<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
				{[1, 2, 3, 4, 5, 6].map((i) => (
					<Card key={i}>
						<CardHeader className="pb-1 pt-3">
							<Skeleton className="h-3 w-16" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-6 w-12" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
