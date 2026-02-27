import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { PendingComponent } from "./components/pending-component";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: {
			...rqContext,
		},

		defaultPreload: "intent",
		// Delay global pending UI to avoid unnecessary shell swaps on fast transitions.
		defaultPendingMs: 200,
		// Don't force pending UI to remain visible once data is ready.
		defaultPendingMinMs: 0,
		defaultPendingComponent: PendingComponent,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient });

	return router;
};
