/**
 * Verifier Credits Hook
 *
 * Event-driven hook to fetch and track MyEmailVerifier API credits.
 * Refetches when verification events occur.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// Query keys
export const VERIFIER_KEYS = {
	credits: ["verifier", "credits"] as const,
};

interface CreditsData {
	credits: number;
	lastUpdated: Date;
}

/**
 * Hook to get verifier credits with event-driven updates
 */
export function useVerifierCredits() {
	const queryClient = useQueryClient();

	const query = useQuery<CreditsData>({
		queryKey: VERIFIER_KEYS.credits,
		queryFn: async () => {
			// TODO: Replace with actual API call when backend endpoint is ready
			// For now, return placeholder data
			// const response = await fetch('/api/verifier/credits');
			// const data = await response.json();
			// return { credits: data.credits, lastUpdated: new Date() };

			// Placeholder - will be replaced with real API call
			return {
				credits: 0,
				lastUpdated: new Date(),
			};
		},
		staleTime: 60 * 1000, // 1 minute
		refetchOnWindowFocus: false,
		// Don't retry on failure - credits are not critical
		retry: false,
	});

	/**
	 * Manually refresh credits (call after verification events)
	 */
	const refreshCredits = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: VERIFIER_KEYS.credits });
	}, [queryClient]);

	return {
		credits: query.data?.credits ?? null,
		lastUpdated: query.data?.lastUpdated ?? null,
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
		refreshCredits,
	};
}

/**
 * Hook to invalidate credits from anywhere (for event-driven updates)
 */
export function useInvalidateVerifierCredits() {
	const queryClient = useQueryClient();

	return useCallback(() => {
		queryClient.invalidateQueries({ queryKey: VERIFIER_KEYS.credits });
	}, [queryClient]);
}
