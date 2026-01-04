import {
	CollectionId,
	DATABASE_ID,
	SETTINGS_DOCUMENT_ID,
} from "@shared/constants/collection.constants";
import type { Settings, SettingsUpdateInput } from "@shared/types/settings.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { databases } from "@/lib/appwrite";

export function useSettings() {
	const queryClient = useQueryClient();

	const { data: settings, isLoading } = useQuery({
		queryKey: ["settings"],
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
					return null; // Handle missing settings (e.g. prompt init)
				}
				throw error;
			}
		},
	});

	const { mutate: updateSettings, isPending: isSaving } = useMutation({
		mutationFn: async (data: SettingsUpdateInput) => {
			// Create if doesn't exist? Ideally init script handles it.
			// Assuming update.
			await databases.updateDocument(
				DATABASE_ID,
				CollectionId.SETTINGS,
				SETTINGS_DOCUMENT_ID,
				data
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["settings"] });
			toast.success("Settings updated successfully");
		},
		onError: (error) => {
			console.error(error);
			toast.error("Failed to update settings");
		},
	});

	return {
		settings,
		isLoading,
		updateSettings,
		isSaving,
	};
}
