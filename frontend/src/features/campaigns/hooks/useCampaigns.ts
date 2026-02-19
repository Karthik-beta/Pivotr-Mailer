/**
 * Campaigns API Hooks
 *
 * TanStack Query hooks for campaigns API.
 */

import {
	keepPreviousData,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	AssignLeadsRequest,
	AssignLeadsResponse,
	CampaignMetricsResponse,
	CampaignResponse,
	CampaignsResponse,
	CreateCampaignRequest,
	LeadPreviewRequest,
	LeadPreviewResponse,
	StatusChangeRequest,
	TestEmailResponse,
	UpdateCampaignRequest,
} from "../types";

// API Base URL - configure based on environment
// SAM local does NOT use stage prefix; deployed AWS API Gateway uses /v1
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Default timeout for API requests (10 seconds)
const DEFAULT_TIMEOUT = 10000;

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new Error("Request timed out. Please check your connection and try again.");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

// =============================================================================
// Query Options Factories (for use in route loaders)
// =============================================================================

export const campaignsQueryOptions = (params?: { limit?: number; status?: string }) =>
	queryOptions({
		queryKey: ["campaigns", params],
		queryFn: async (): Promise<CampaignsResponse> => {
			const searchParams = new URLSearchParams();
			if (params?.limit) searchParams.set("limit", String(params.limit));
			if (params?.status) searchParams.set("status", params.status);

			const response = await fetchWithTimeout(`${API_BASE}/campaigns?${searchParams}`);
			if (!response.ok) throw new Error("Failed to fetch campaigns");
			return response.json();
		},
	});

export const campaignQueryOptions = (id: string) =>
	queryOptions({
		queryKey: ["campaigns", id],
		queryFn: async (): Promise<CampaignResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`);
			if (!response.ok) throw new Error("Failed to fetch campaign");
			return response.json();
		},
		enabled: !!id,
	});

// =============================================================================
// Campaigns Queries
// =============================================================================

export function useCampaigns(params?: { limit?: number; status?: string }) {
	return useQuery({
		...campaignsQueryOptions(params),
		// Show stale list data while a fresh fetch is in-flight (e.g. after status filter change).
		// Prevents the table from blanking out between param changes.
		placeholderData: keepPreviousData,
	});
}

export function useCampaign(id: string) {
	return useQuery(campaignQueryOptions(id));
}

export function useCampaignMetrics(id: string) {
	return useQuery({
		queryKey: ["campaigns", id, "metrics"],
		queryFn: async (): Promise<CampaignMetricsResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/metrics`);
			if (!response.ok) throw new Error("Failed to fetch campaign metrics");
			return response.json();
		},
		enabled: !!id,
		refetchInterval: 30000, // Refetch every 30 seconds for running campaigns
	});
}

// =============================================================================
// Campaigns Mutations
// =============================================================================

export function useCreateCampaign() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateCampaignRequest): Promise<CampaignResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to create campaign");
			}
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
		},
	});
}

export function useUpdateCampaign() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string;
			data: UpdateCampaignRequest;
		}): Promise<CampaignResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to update campaign");
			}
			return response.json();
		},
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
		},
	});
}

export function useDeleteCampaign() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string): Promise<{ success: boolean }> => {
			// Cancel in-flight campaign queries to avoid SAM CLI concurrency issues
			await queryClient.cancelQueries({ queryKey: ["campaigns", id] });

			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to delete campaign");
			}
			return response.json();
		},
		retry: 2,
		retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
		},
	});
}

export function useChangeCampaignStatus() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			status,
		}: {
			id: string;
			status: StatusChangeRequest["status"];
		}): Promise<CampaignResponse> => {
			// Cancel in-flight campaign queries to avoid SAM CLI concurrency issues
			await queryClient.cancelQueries({ queryKey: ["campaigns", id] });

			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/status`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to change campaign status");
			}
			return response.json();
		},
		retry: 2,
		retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
		},
	});
}

export function useSendTestEmail() {
	return useMutation({
		mutationFn: async ({
			id,
			recipientEmail,
		}: {
			id: string;
			recipientEmail: string;
		}): Promise<TestEmailResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/test-email`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ recipientEmail }),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to send test email");
			}
			return response.json();
		},
	});
}

export function usePreviewLeads() {
	return useMutation({
		mutationFn: async (data: LeadPreviewRequest): Promise<LeadPreviewResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/preview-leads`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to preview leads");
			}
			return response.json();
		},
	});
}

export function useAssignLeads() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string;
			data: AssignLeadsRequest;
		}): Promise<AssignLeadsResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/assign-leads`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to assign leads");
			}
			return response.json();
		},
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns", id, "metrics"] });
		},
	});
}

export function useVerifyCampaignLeads() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string): Promise<{ success: boolean; data: unknown }> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/verify`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to verify leads");
			}
			return response.json();
		},
		onSuccess: (_, id) => {
			queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
			queryClient.invalidateQueries({ queryKey: ["campaigns", id, "metrics"] });
		},
	});
}
