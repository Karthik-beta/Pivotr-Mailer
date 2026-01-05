import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Lead } from "@shared/types/lead.types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";

import { leadsKeys } from "@/lib/query-keys";

export function useLeads(page: number = 1, limit: number = 50, search?: string) {
	return useQuery({
		queryKey: leadsKeys.list(page, limit, search),
		queryFn: async () => {
			const offset = (page - 1) * limit;
			const queries = [Query.limit(limit), Query.offset(offset), Query.orderDesc("$createdAt")];

			if (search) {
				queries.push(Query.search("email", search)); // Or fullName
			}

			const response = await databases.listDocuments(DATABASE_ID, CollectionId.LEADS, queries);

			return {
				leads: response.documents as unknown as Lead[],
				total: response.total,
			};
		},
		placeholderData: keepPreviousData,
	});
}
