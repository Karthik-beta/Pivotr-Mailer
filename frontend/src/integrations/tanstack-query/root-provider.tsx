import {
	type DehydratedState,
	hydrate,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";

export function getContext(initialState?: DehydratedState) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 30, // 30 minutes
				refetchOnWindowFocus: false,
				// Retry on Lambda cold starts / transient network errors
				retry: 2,
				retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
			},
		},
	});

	if (initialState) {
		hydrate(queryClient, initialState);
	}

	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
