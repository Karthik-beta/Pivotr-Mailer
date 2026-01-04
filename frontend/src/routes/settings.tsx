import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm } from "@/features/settings/components/settings-form";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	return (
		<div className="p-8 max-w-[1200px] mx-auto space-y-6">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-bold tracking-tight mb-2">Configuration</h1>
				<p className="text-muted-foreground">
					Global settings for AWS SES, SQS, and system variables.
				</p>
			</div>

			<div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm mb-6">
				<strong>Warning:</strong> Changes to system limits and keys will affect all active
				campaigns. Proceed with caution.
			</div>

			<SettingsForm />
		</div>
	);
}
