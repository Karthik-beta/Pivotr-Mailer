import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Log } from "@shared/types/log.types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import { databases } from "@/lib/appwrite";

export function useAuditLogs(
	page: number = 1,
	limit: number = 20,
	filters?: { severity?: string; search?: string }
) {
	return useQuery({
		queryKey: ["audit-logs", page, limit, filters?.severity, filters?.search],
		queryFn: async () => {
			const offset = (page - 1) * limit;
			const queries = [Query.limit(limit), Query.offset(offset), Query.orderDesc("$createdAt")];

			if (filters?.severity && filters.severity !== "all") {
				queries.push(Query.equal("severity", filters.severity));
			}

			if (filters?.search) {
				// Search in message
				queries.push(Query.search("message", filters.search));
			}

			const response = await databases.listDocuments(DATABASE_ID, CollectionId.LOGS, queries);

			return {
				logs: response.documents as unknown as Log[],
				total: response.total,
			};
		},
		placeholderData: keepPreviousData,
	});
}
