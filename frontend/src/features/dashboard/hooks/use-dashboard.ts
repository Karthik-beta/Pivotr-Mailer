import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Campaign } from "@shared/types/campaign.types";
import type { Log } from "@shared/types/log.types";
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Query } from "appwrite";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/features/shared/hooks/use-realtime";
import { databases } from "@/lib/appwrite";
import { campaignKeys, logsKeys } from "@/lib/query-keys";

export function useDashboard() {
	const queryClient = useQueryClient();

	// 1. Queries
	const { data: activeCampaign } = useSuspenseQuery({
		queryKey: campaignKeys.active(),
		queryFn: async () => {
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
				Query.orderDesc("$createdAt"),
				Query.limit(1),
			]);
			return response.documents.length > 0 ? (response.documents[0] as unknown as Campaign) : null;
		},
		staleTime: 1000 * 60, // 1 minute
	});

	const { data: recentLogs } = useSuspenseQuery({
		queryKey: logsKeys.recent(),
		queryFn: async () => {
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
				Query.orderDesc("$createdAt"),
				Query.limit(50),
			]);
			// Reverse to show oldest at top in console (console auto-scrolls)
			return (response.documents as unknown as Log[]).reverse();
		},
		staleTime: 1000 * 60,
	});

	// 2. Mutations
	const { mutate: updateCampaignStatus } = useMutation({
		mutationFn: async (status: string) => {
			if (!activeCampaign) return;
			await databases.updateDocument(DATABASE_ID, CollectionId.CAMPAIGNS, activeCampaign.$id, {
				status,
			});
		},
		onSuccess: (_, status) => {
			queryClient.invalidateQueries({ queryKey: campaignKeys.active() });
			toast.success(`Campaign ${status}`);
		},
		onError: (error, status) => {
			console.error(error);
			toast.error(`Failed to update status to ${status}`);
		},
	});

	// 3. Realtime Subscriptions
	useRealtimeSubscription(
		`databases.${DATABASE_ID}.collections.${CollectionId.CAMPAIGNS}.documents`,
		(response) => {
			if (activeCampaign && (response.payload as Campaign).$id === activeCampaign.$id) {
				const updatedCampaign = response.payload as unknown as Campaign;
				queryClient.setQueryData(campaignKeys.active(), updatedCampaign);
			} else if (
				!activeCampaign &&
				response.events.includes("databases.*.collections.*.documents.*.create")
			) {
				queryClient.invalidateQueries({ queryKey: campaignKeys.active() });
			}
		}
	);

	useRealtimeSubscription(
		`databases.${DATABASE_ID}.collections.${CollectionId.LOGS}.documents`,
		(response) => {
			if (response.events.includes("databases.*.collections.*.documents.*.create")) {
				const newLog = response.payload as unknown as Log;
				queryClient.setQueryData(logsKeys.recent(), (oldLogs: Log[] | undefined) => {
					const currentLogs = oldLogs || [];
					const updated = [...currentLogs, newLog];
					if (updated.length > 100) return updated.slice(updated.length - 100);
					return updated;
				});
			}
		}
	);

	return {
		activeCampaign,
		recentLogs,
		updateCampaignStatus,
	};
}
