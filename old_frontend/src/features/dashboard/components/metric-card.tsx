import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils"; // Assumed from Shadcn utils

interface MetricCardProps {
	label: string;
	value: number | string;
	icon: LucideIcon;
	subtext?: string;
	trend?: "up" | "down" | "neutral";
	color?: string; // Optional color override
}

export function MetricCard({ label, value, icon: Icon, subtext, color }: MetricCardProps) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
				<Icon className={cn("h-4 w-4 text-muted-foreground", color)} />
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold font-mono">{value}</div>
				{subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
			</CardContent>
		</Card>
	);
}
