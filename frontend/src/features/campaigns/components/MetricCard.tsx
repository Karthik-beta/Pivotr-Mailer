/**
 * MetricCard Component
 *
 * Reusable metric display card with gradient backgrounds.
 * Used in campaign dashboards and overview sections.
 */

import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GradientColor = "slate" | "emerald" | "green" | "blue" | "amber" | "red" | "purple";

interface MetricCardProps {
	title: string;
	value?: number;
	icon: LucideIcon;
	gradient?: GradientColor;
	size?: "default" | "sm";
	subValue?: string;
	percentage?: number;
	className?: string;
}

const gradientClasses: Record<GradientColor, string> = {
	slate:
		"bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700",
	emerald:
		"bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800",
	green:
		"bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800",
	blue: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800",
	amber:
		"bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800",
	red: "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800",
	purple:
		"bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800",
};

const iconColorClasses: Record<GradientColor, string> = {
	slate: "text-slate-600",
	emerald: "text-emerald-600",
	green: "text-green-600",
	blue: "text-blue-600",
	amber: "text-amber-600",
	red: "text-red-600",
	purple: "text-purple-600",
};

const valueColorClasses: Record<GradientColor, string> = {
	slate: "",
	emerald: "text-emerald-700 dark:text-emerald-400",
	green: "text-green-700 dark:text-green-400",
	blue: "text-blue-700 dark:text-blue-400",
	amber: "text-amber-700 dark:text-amber-400",
	red: "text-red-700 dark:text-red-400",
	purple: "text-purple-700 dark:text-purple-400",
};

export function MetricCard({
	title,
	value = 0,
	icon: Icon,
	gradient = "slate",
	size = "default",
	subValue,
	percentage,
	className,
}: MetricCardProps) {
	return (
		<Card className={cn(gradientClasses[gradient], className)}>
			<CardHeader
				className={cn(
					"flex flex-row items-center justify-between space-y-0",
					size === "sm" ? "pb-1 pt-3" : "pb-2"
				)}
			>
				<CardTitle className={cn("font-medium", size === "sm" ? "text-xs" : "text-sm")}>
					{title}
				</CardTitle>
				<Icon className={cn(iconColorClasses[gradient], size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
			</CardHeader>
			<CardContent>
				<div
					className={cn(
						"font-bold font-mono",
						valueColorClasses[gradient],
						size === "sm" ? "text-lg" : "text-2xl"
					)}
				>
					{value.toLocaleString()}
				</div>
				{percentage !== undefined && (
					<p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% rate</p>
				)}
				{subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
			</CardContent>
		</Card>
	);
}
