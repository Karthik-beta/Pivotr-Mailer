import {
	CollectionId,
	DATABASE_ID,
	STALE_LOCK_THRESHOLD_MS,
} from "@shared/constants/collection.constants";
import { CampaignStatus } from "@shared/constants/status.constants";
import type { Campaign } from "@shared/types/campaign.types";
import { useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";

export function useSystemHealth() {
	return useQuery({
		queryKey: ["system-health"],
		queryFn: async () => {
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
				Query.equal("status", [CampaignStatus.RUNNING, CampaignStatus.ABORTING]),
				Query.limit(100),
			]);

			const campaigns = response.documents as unknown as Campaign[];
			const now = Date.now();

			const staleCampaigns = campaigns.filter((c) => {
				if (!c.lastActivityAt) return true; // Running but no activity? Stale.
				const lastActive = new Date(c.lastActivityAt).getTime();
				return now - lastActive > STALE_LOCK_THRESHOLD_MS;
			});

			return {
				isHealthy: staleCampaigns.length === 0,
				staleCampaigns,
			};
		},
		refetchInterval: 30000, // Check every 30s
	});
}
