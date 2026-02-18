import {
	type DehydratedState,
	QueryClient,
	QueryClientProvider,
	hydrate,
} from "@tanstack/react-query";

export function getContext(initialState?: DehydratedState) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 30, // 30 minutes
				refetchOnWindowFocus: false,
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
