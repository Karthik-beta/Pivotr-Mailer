import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Lead } from "@shared/types/lead.types";
import { useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";

export function useRandomLead() {
	return useQuery({
		queryKey: ["random-lead"],
		queryFn: async () => {
			// For now, just get the latest one.
			// Theoretically "Random" requires offset count logic, but latest is fine for preview.
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, [
				Query.limit(1),
				Query.orderDesc("$createdAt"), // Or just standard order
			]);

			if (response.documents.length === 0) return null;
			return response.documents[0] as unknown as Lead;
		},
		staleTime: 1000 * 60 * 5, // Cache for 5 mins
	});
}
