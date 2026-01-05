import {
	CollectionId,
	DATABASE_ID,
	SETTINGS_DOCUMENT_ID,
} from "@shared/constants/collection.constants";
import type { Settings } from "@shared/types/settings.types";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsForm, SettingsSkeleton } from "@/features/settings/components/settings-form";
import { databases } from "@/lib/appwrite";
import { settingsKeys } from "@/lib/query-keys";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
	loader: async ({ context: { queryClient } }) => {
		await queryClient.ensureQueryData({
			queryKey: settingsKeys.all,
			queryFn: async () => {
				try {
					const response = await databases.getDocument(
						DATABASE_ID,
						CollectionId.SETTINGS,
						SETTINGS_DOCUMENT_ID
					);
					return response as unknown as Settings;
				} catch (error: unknown) {
					if (error && typeof error === "object" && "code" in error && error.code === 404) {
						return null;
					}
					throw error;
				}
			},
		});
	},
	pendingComponent: SettingsSkeleton,
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
