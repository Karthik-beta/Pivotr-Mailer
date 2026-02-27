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
	Campaign,
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
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;
const METRICS_STALE_TIME = 15 * 1000;

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
	const controller = new AbortController();
	const externalSignal = options.signal;
	let didTimeout = false;
	const timeoutId = setTimeout(() => {
		didTimeout = true;
		controller.abort();
	}, timeout);
	const abortFromExternalSignal = () => controller.abort();

	if (externalSignal) {
		if (externalSignal.aborted) {
			abortFromExternalSignal();
		} else {
			externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
		}
	}

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal,
		});
		return response;
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError" && didTimeout) {
			throw new Error("Request timed out. Please check your connection and try again.");
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
		externalSignal?.removeEventListener("abort", abortFromExternalSignal);
	}
}

// =============================================================================
// Query Options Factories (for use in route loaders)
// =============================================================================

export const campaignsQueryOptions = (params?: { limit?: number; status?: string }) =>
	queryOptions({
		queryKey: ["campaigns", params],
		queryFn: async ({ signal }): Promise<CampaignsResponse> => {
			const searchParams = new URLSearchParams();
			if (params?.limit) searchParams.set("limit", String(params.limit));
			if (params?.status) searchParams.set("status", params.status);

			const response = await fetchWithTimeout(`${API_BASE}/campaigns?${searchParams}`, { signal });
			if (!response.ok) throw new Error("Failed to fetch campaigns");
			return response.json();
		},
		staleTime: LIST_STALE_TIME,
	});

export const campaignQueryOptions = (id: string) =>
	queryOptions({
		queryKey: ["campaigns", id],
		queryFn: async ({ signal }): Promise<CampaignResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}`, { signal });
			if (!response.ok) throw new Error("Failed to fetch campaign");
			return response.json();
		},
		enabled: !!id,
		staleTime: DETAIL_STALE_TIME,
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
		queryFn: async ({ signal }): Promise<CampaignMetricsResponse> => {
			const response = await fetchWithTimeout(`${API_BASE}/campaigns/${id}/metrics`, { signal });
			if (!response.ok) throw new Error("Failed to fetch campaign metrics");
			return response.json();
		},
		enabled: !!id,
		staleTime: METRICS_STALE_TIME,
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
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: ["campaigns"] });

			const previousCampaignQueries = queryClient.getQueriesData<CampaignsResponse>({
				queryKey: ["campaigns"],
			});
			const previousCampaign = queryClient.getQueryData<CampaignResponse>(["campaigns", id]);

			queryClient.setQueriesData<CampaignsResponse>({ queryKey: ["campaigns"] }, (old) => {
				if (!old) return old;

				return {
					...old,
					data: old.data.filter((campaign) => campaign.id !== id),
				};
			});

			queryClient.removeQueries({ queryKey: ["campaigns", id], exact: true });

			return { id, previousCampaignQueries, previousCampaign };
		},
		onError: (_error, _id, context) => {
			if (!context) return;

			for (const [queryKey, previousData] of context.previousCampaignQueries) {
				queryClient.setQueryData(queryKey, previousData);
			}

			if (context.previousCampaign) {
				queryClient.setQueryData(["campaigns", context.id], context.previousCampaign);
			}
		},
		onSettled: (_result, _error, id) => {
			queryClient.invalidateQueries({ queryKey: ["campaigns"] });
			queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
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
		onMutate: async ({ id, status }) => {
			await queryClient.cancelQueries({ queryKey: ["campaigns"] });

			const previousCampaignQueries = queryClient.getQueriesData<CampaignsResponse>({
				queryKey: ["campaigns"],
			});
			const previousCampaign = queryClient.getQueryData<CampaignResponse>(["campaigns", id]);

			queryClient.setQueriesData<CampaignsResponse>({ queryKey: ["campaigns"] }, (old) => {
				if (!old) return old;

				return {
					...old,
					data: old.data.map((campaign: Campaign) =>
						campaign.id === id
							? {
									...campaign,
									status,
									updatedAt: new Date().toISOString(),
								}
							: campaign
					),
				};
			});

			queryClient.setQueryData<CampaignResponse>(["campaigns", id], (old) => {
				if (!old) return old;

				return {
					...old,
					data: {
						...old.data,
						status,
						updatedAt: new Date().toISOString(),
					},
				};
			});

			return { id, previousCampaignQueries, previousCampaign };
		},
		onError: (_error, _variables, context) => {
			if (!context) return;

			for (const [queryKey, previousData] of context.previousCampaignQueries) {
				queryClient.setQueryData(queryKey, previousData);
			}

			if (context.previousCampaign) {
				queryClient.setQueryData(["campaigns", context.id], context.previousCampaign);
			}
		},
		onSettled: (_result, _error, { id }) => {
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
