/**
 * ConfirmStatusDialog Component
 *
 * Dialog for confirming status changes (start, abort, delete).
 */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type ActionType = "start" | "pause" | "resume" | "abort" | "delete";

interface ConfirmStatusDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	action: ActionType;
	campaignName: string;
	onConfirm: () => void;
	isLoading?: boolean;
}

const ACTION_CONFIG: Record<
	ActionType,
	{
		title: string;
		description: string;
		confirmLabel: string;
		variant: "default" | "destructive";
	}
> = {
	start: {
		title: "Start Campaign",
		description:
			"This will begin sending emails to the assigned leads. Make sure your email template is ready.",
		confirmLabel: "Start Campaign",
		variant: "default",
	},
	pause: {
		title: "Pause Campaign",
		description: "This will temporarily stop sending emails. You can resume the campaign later.",
		confirmLabel: "Pause Campaign",
		variant: "default",
	},
	resume: {
		title: "Resume Campaign",
		description: "This will continue sending emails from where the campaign was paused.",
		confirmLabel: "Resume Campaign",
		variant: "default",
	},
	abort: {
		title: "Abort Campaign",
		description:
			"This will permanently stop the campaign. This action cannot be undone and any remaining leads will not be sent.",
		confirmLabel: "Abort Campaign",
		variant: "destructive",
	},
	delete: {
		title: "Delete Campaign",
		description:
			"This will permanently delete the campaign and all its data. This action cannot be undone.",
		confirmLabel: "Delete Campaign",
		variant: "destructive",
	},
};

export function ConfirmStatusDialog({
	open,
	onOpenChange,
	action,
	campaignName,
	onConfirm,
	isLoading = false,
}: ConfirmStatusDialogProps) {
	const config = ACTION_CONFIG[action];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{(action === "abort" || action === "delete") && (
							<AlertTriangle className="h-5 w-5 text-destructive" />
						)}
						{config.title}
					</DialogTitle>
					<DialogDescription className="space-y-2" asChild>
						<div className="text-sm text-muted-foreground">
							<p>{config.description}</p>
							<p className="font-medium text-foreground">Campaign: {campaignName}</p>
						</div>
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
						Cancel
					</Button>
					<Button variant={config.variant} onClick={onConfirm} disabled={isLoading}>
						{isLoading && <RefreshCw className="animate-spin mr-2 h-4 w-4" />}
						{config.confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
