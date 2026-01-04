import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Campaign } from "@shared/types/campaign.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Query } from "appwrite";
import { toast } from "sonner";
import { databases } from "@/lib/appwrite";

export function useTemplate() {
	const queryClient = useQueryClient();

	const { data: campaign, isLoading } = useQuery({
		queryKey: ["active-campaign-template"],
		queryFn: async () => {
			// Fetch latest campaign
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.CAMPAIGNS, [
				Query.orderDesc("$createdAt"),
				Query.limit(1),
			]);
			return response.documents[0] as unknown as Campaign | undefined;
		},
	});

	const { mutate: saveTemplate, isPending: isSaving } = useMutation({
		mutationFn: async (data: { subjectTemplate: string; bodyTemplate: string }) => {
			if (!campaign) throw new Error("No active campaign");
			await databases.updateDocument(DATABASE_ID, CollectionId.CAMPAIGNS, campaign.$id, data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["active-campaign-template"] });
			toast.success("Template saved");
		},
		onError: (error) => {
			console.error(error);
			toast.error("Failed to save template");
		},
	});

	return {
		campaign,
		isLoading,
		saveTemplate,
		isSaving,
	};
}
