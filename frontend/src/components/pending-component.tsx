/**
 * Default Pending Component
 *
 * Shown by the router while a route loader is in flight.
 * Wraps the skeleton in the full Layout so the sidebar never disappears
 * during page transitions — the skeleton renders inside the existing shell.
 */

import { BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/features/shared/Layout";

export function PendingComponent() {
	return (
		<Layout
			breadcrumbs={
				<BreadcrumbItem>
					<BreadcrumbPage>
						<Skeleton className="h-4 w-24" />
					</BreadcrumbPage>
				</BreadcrumbItem>
			}
		>
			<div className="flex flex-1 flex-col gap-6 p-6">
				{/* Page header skeleton */}
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-72" />
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-9 w-24" />
						<Skeleton className="h-9 w-32" />
					</div>
				</div>

				{/* Stats cards skeleton */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div key={i} className="rounded-xl border bg-card p-6 space-y-3">
							<div className="flex items-center justify-between">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-4 w-4 rounded" />
							</div>
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-3 w-24" />
						</div>
					))}
				</div>

				{/* Table / content skeleton */}
				<div className="rounded-xl border bg-card p-6 space-y-4">
					<div className="space-y-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-56" />
					</div>
					{/* Table header */}
					<div className="flex gap-4 pb-2 border-b">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-4 flex-1" />
						))}
					</div>
					{/* Table rows */}
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="flex gap-4 py-2">
							{Array.from({ length: 5 }).map((_, j) => (
								<Skeleton key={j} className="h-4 flex-1" />
							))}
						</div>
					))}
				</div>
			</div>
		</Layout>
	);
}
