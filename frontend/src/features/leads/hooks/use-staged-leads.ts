import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { FieldValidationIssue, StagedLead } from "@shared/types/staged-lead.types";
import { validateStagedLead } from "@shared/validation/lead-validator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Query } from "appwrite";
import { toast } from "sonner";
import { databases, functions } from "@/lib/appwrite";
import { stagedLeadsKeys } from "@/lib/query-keys";

/**
 * Fetches staged leads from database, optionally filtered by batch
 */
export function useStagedLeads(batchId?: string) {
	return useQuery({
		queryKey: stagedLeadsKeys.list(batchId),
		queryFn: async () => {
			const queries = [Query.orderDesc("$createdAt"), Query.limit(500)];
			if (batchId) {
				queries.push(Query.equal("batchId", batchId));
			}

			const response = await databases.listDocuments(
				DATABASE_ID,
				CollectionId.STAGED_LEADS,
				queries
			);

			// Parse validationErrors from JSON string
			return response.documents.map((doc) => ({
				...doc,
				validationErrors:
					typeof doc.validationErrors === "string"
						? (JSON.parse(doc.validationErrors) as FieldValidationIssue[])
						: (doc.validationErrors as FieldValidationIssue[]) || [],
			})) as unknown as StagedLead[];
		},
	});
}

/**
 * Fetches unique batch IDs for batch filtering
 */
export function useStagedBatches() {
	return useQuery({
		queryKey: stagedLeadsKeys.batches(),
		queryFn: async () => {
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.STAGED_LEADS, [
				Query.orderDesc("importedAt"),
				Query.limit(100),
			]);

			// Extract unique batches with their first importedAt timestamp
			const batchMap = new Map<string, { batchId: string; importedAt: string; count: number }>();
			for (const doc of response.documents) {
				const batchId = doc.batchId as string;
				if (!batchMap.has(batchId)) {
					batchMap.set(batchId, {
						batchId,
						importedAt: doc.importedAt as string,
						count: 1,
					});
				} else {
					const existing = batchMap.get(batchId);
					if (existing) existing.count++;
				}
			}

			return Array.from(batchMap.values());
		},
	});
}

/**
 * Updates a single staged lead field and revalidates
 */
export function useUpdateStagedLead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			documentId,
			field,
			value,
		}: {
			documentId: string;
			field: "fullName" | "email" | "companyName";
			value: string;
		}) => {
			// First get current document to revalidate
			const doc = await databases.getDocument(DATABASE_ID, CollectionId.STAGED_LEADS, documentId);

			const updated = {
				fullName: field === "fullName" ? value : doc.fullName,
				email: field === "email" ? value : doc.email,
				companyName: field === "companyName" ? value : doc.companyName,
			};

			// Revalidate
			const { issues, isValid } = validateStagedLead(updated);

			// Update document
			return databases.updateDocument(DATABASE_ID, CollectionId.STAGED_LEADS, documentId, {
				[field]: value,
				validationErrors: JSON.stringify(issues),
				isValid,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: stagedLeadsKeys.all });
		},
		onError: (error) => {
			toast.error("Failed to update lead", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}

/**
 * Deletes a staged lead
 */
export function useDeleteStagedLead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (documentId: string) => {
			await databases.deleteDocument(DATABASE_ID, CollectionId.STAGED_LEADS, documentId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: stagedLeadsKeys.all });
		},
		onError: (error) => {
			toast.error("Failed to delete lead", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}

/**
 * Approves valid staged leads (moves to main leads collection)
 */
export function useApproveStagedLeads() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ batchId, leadIds }: { batchId: string; leadIds?: string[] }) => {
			const execution = await functions.createExecution(
				"approve-staged-leads",
				JSON.stringify({ batchId, leadIds }),
				false
			);

			if (execution.responseStatusCode >= 400) {
				const errorData = JSON.parse(execution.responseBody || "{}");
				throw new Error(errorData.message || "Failed to approve leads");
			}

			return JSON.parse(execution.responseBody);
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: stagedLeadsKeys.all });
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			toast.success(`Approved ${data.imported} leads`, {
				description: data.skipped > 0 ? `${data.skipped} skipped` : undefined,
			});
		},
		onError: (error) => {
			toast.error("Failed to approve leads", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}

/**
 * Deletes an entire batch of staged leads
 */
export function useDeleteStagedBatch() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (batchId: string) => {
			// Fetch all leads in batch
			const response = await databases.listDocuments(DATABASE_ID, CollectionId.STAGED_LEADS, [
				Query.equal("batchId", batchId),
				Query.limit(1000),
			]);

			// Delete each document
			await Promise.all(
				response.documents.map((doc) =>
					databases.deleteDocument(DATABASE_ID, CollectionId.STAGED_LEADS, doc.$id)
				)
			);

			return { deleted: response.documents.length };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: stagedLeadsKeys.all });
			toast.success(`Deleted ${data.deleted} staged leads`);
		},
		onError: (error) => {
			toast.error("Failed to delete batch", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}
