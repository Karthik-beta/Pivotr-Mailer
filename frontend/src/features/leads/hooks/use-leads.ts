import { CollectionId, DATABASE_ID } from "@shared/constants/collection.constants";
import type { Lead, LeadCreateInput, LeadUpdateInput } from "@shared/types/lead.types";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import { toast } from "sonner";
import { databases, functions } from "@/lib/appwrite";
import { leadsKeys } from "@/lib/query-keys";

export function useLeads(page: number = 1, limit: number = 50, search?: string) {
	return useSuspenseQuery({
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
	});
}

/**
 * Creates a new lead via Appwrite Function
 */
export function useCreateLead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (input: LeadCreateInput) => {
			const execution = await functions.createExecution({
				functionId: "create-lead",
				body: JSON.stringify({
					fullName: input.fullName,
					email: input.email,
					companyName: input.companyName,
					phoneNumber: input.phoneNumber || null,
					leadType: input.leadType || null,
				}),
				async: false,
			});

			// Check for execution errors
			if (execution.responseStatusCode >= 400) {
				let errorMessage = "Failed to create lead";
				try {
					const errorData = JSON.parse(execution.responseBody || "{}");
					errorMessage = errorData.message || errorMessage;
				} catch {
					// Use default error message
				}
				throw new Error(errorMessage);
			}

			const response = JSON.parse(execution.responseBody || "{}");
			if (!response.success) {
				throw new Error(response.message || "Failed to create lead");
			}

			return response.lead as Lead;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			toast.success("Lead created successfully");
		},
		onError: (error) => {
			toast.error("Failed to create lead", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}

/**
 * Updates a lead via Appwrite Function
 */
export function useUpdateLead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ leadId, data }: { leadId: string; data: LeadUpdateInput }) => {
			const execution = await functions.createExecution({
				functionId: "update-lead",
				body: JSON.stringify({ leadId, data }),
				async: false,
			});

			// Check for execution errors
			if (execution.responseStatusCode >= 400) {
				let errorMessage = "Failed to update lead";
				try {
					const errorData = JSON.parse(execution.responseBody || "{}");
					errorMessage = errorData.message || errorMessage;
				} catch {
					// Use default error message
				}
				throw new Error(errorMessage);
			}

			const response = JSON.parse(execution.responseBody || "{}");
			if (!response.success) {
				throw new Error(response.message || "Failed to update lead");
			}

			return response.lead;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
		},
		onError: (error) => {
			toast.error("Failed to update lead", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}

/**
 * Deletes a lead via Appwrite Function
 */
export function useDeleteLead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (leadId: string) => {
			const execution = await functions.createExecution({
				functionId: "delete-lead",
				body: JSON.stringify({ leadId }),
				async: false,
			});

			// Check for execution errors
			if (execution.responseStatusCode >= 400) {
				let errorMessage = "Failed to delete lead";
				try {
					const errorData = JSON.parse(execution.responseBody || "{}");
					errorMessage = errorData.message || errorMessage;
				} catch {
					// Use default error message
				}
				throw new Error(errorMessage);
			}

			const response = JSON.parse(execution.responseBody || "{}");
			if (!response.success) {
				throw new Error(response.message || "Failed to delete lead");
			}

			return response.deletedId;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			toast.success("Lead deleted successfully");
		},
		onError: (error) => {
			toast.error("Failed to delete lead", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});
}
