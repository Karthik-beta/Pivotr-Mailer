import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemHealth } from "../hooks/use-system-health";

export function RecoveryBanner() {
	const { data, isLoading } = useSystemHealth();
	const navigate = useNavigate();

	if (isLoading || !data || data.isHealthy) return null;

	return (
		<div className="bg-destructive text-destructive-foreground px-4 py-3 flex items-center justify-between shadow-md relative z-50">
			<div className="flex items-center gap-3">
				<AlertCircle className="h-5 w-5 animate-pulse" />
				<span className="font-medium text-sm">
					System Alert: {data.staleCampaigns.length} campaign(s) appear stalled or locked.
				</span>
			</div>
			<div className="flex items-center gap-2">
				{/* In real app, this might trigger a server-side recovery job */}
				<Button
					variant="secondary"
					size="sm"
					className="h-7 text-xs"
					onClick={() => navigate({ to: "/" })} // Go to dashboard
				>
					<RefreshCw className="h-3 w-3 mr-1" />
					Check Dashboard
				</Button>
			</div>
		</div>
	);
}
