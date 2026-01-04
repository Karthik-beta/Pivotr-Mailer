import { CampaignStatus, type CampaignStatusType } from "@shared/constants/status.constants";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignControlsProps {
	status: CampaignStatusType;
	onAction: (action: "start" | "pause" | "abort") => void;
	isPending?: boolean;
}

export function CampaignControls({ status, onAction, isPending }: CampaignControlsProps) {
	const isRunning = status === CampaignStatus.RUNNING;
	const isPaused = status === CampaignStatus.PAUSED;
	const isQueued = status === CampaignStatus.QUEUED;
	const isDraft = status === CampaignStatus.DRAFT;

	// Can start if Draft, Queued, or Paused
	const canStart = isDraft || isQueued || isPaused;

	// Can pause if Running
	const canPause = isRunning;

	// Can abort if Running, Paused, or Queued
	const canAbort = isRunning || isPaused || isQueued;

	return (
		<div className="flex items-center gap-2">
			{canStart && (
				<Button variant="outline" size="sm" onClick={() => onAction("start")} disabled={isPending}>
					{isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : (
						<Play className="h-4 w-4 mr-2" />
					)}
					Start
				</Button>
			)}

			{canPause && (
				<Button variant="outline" size="sm" onClick={() => onAction("pause")} disabled={isPending}>
					{isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : (
						<Pause className="h-4 w-4 mr-2" />
					)}
					Pause
				</Button>
			)}

			{canAbort && (
				<Button
					variant="destructive"
					size="sm"
					onClick={() => onAction("abort")}
					disabled={isPending}
				>
					{isPending ? (
						<Loader2 className="h-4 w-4 animate-spin mr-2" />
					) : (
						<Square className="h-4 w-4 mr-2" />
					)}
					Abort
				</Button>
			)}

			{!canStart && !canPause && !canAbort && (
				<span className="text-sm text-muted-foreground italic">{status}</span>
			)}
		</div>
	);
}
