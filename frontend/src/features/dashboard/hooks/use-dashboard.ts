import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Campaign } from "@shared/types/campaign.types";
import type { Log } from "@shared/types/log.types";
import { Query } from "appwrite";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/features/shared/hooks/use-realtime";
import { databases } from "@/lib/appwrite";

export function useDashboard() {
	const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
	const [recentLogs, setRecentLogs] = useState<Log[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Initial Fetch
	useEffect(() => {
		async function init() {
			try {
				// Fetch latest campaign
				const campaignRes = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
					Query.orderDesc("$createdAt"),
					Query.limit(1),
				]);

				if (campaignRes.documents.length > 0) {
					setActiveCampaign(campaignRes.documents[0] as unknown as Campaign);
				}

				// Fetch recent logs
				const logsRes = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, [
					Query.orderDesc("$createdAt"),
					Query.limit(50),
				]);
				// Reverse to show oldest at top in console (console auto-scrolls)
				setRecentLogs((logsRes.documents as unknown as Log[]).reverse());
			} catch (error) {
				console.error("Failed to load dashboard data", error);
				toast.error("Failed to load dashboard data");
			} finally {
				setIsLoading(false);
			}
		}

		init();
	}, []);

	// Realtime Subscriptions
	useRealtimeSubscription(
		`databases.${DATABASE_ID}.collections.${CollectionId.CAMPAIGNS}.documents`,
		(response) => {
			// If the event is for the active campaign, update it
			if (activeCampaign && (response.payload as { $id: string }).$id === activeCampaign.$id) {
				setActiveCampaign(response.payload as unknown as Campaign);
			}
			// Or if it's a new campaign and we don't have one, or it's newer?
			// For simplicity, just update if it matches active.
		}
	);

	useRealtimeSubscription(
		`databases.${DATABASE_ID}.collections.${CollectionId.LOGS}.documents`,
		(response) => {
			if (response.events.includes("databases.*.collections.*.documents.*.create")) {
				const newLog = response.payload as unknown as Log;
				setRecentLogs((prev) => {
					const updated = [...prev, newLog];
					if (updated.length > 100) return updated.slice(updated.length - 100);
					return updated;
				});
			}
		}
	);

	// Actions
	const updateCampaignStatus = async (status: string) => {
		if (!activeCampaign) return;
		try {
			await databases.updateDocument(DATABASE_ID, CollectionId.CAMPAIGNS, activeCampaign.$id, {
				status,
			});
			toast.success(`Campaign ${status}`);
		} catch (e) {
			console.error(e);
			toast.error(`Failed to update status to ${status}`);
		}
	};

	return {
		activeCampaign,
		recentLogs,
		isLoading,
		updateCampaignStatus,
	};
}
