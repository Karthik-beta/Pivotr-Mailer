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
		// Show pending UI immediately — no frozen page during loader
		defaultPendingMs: 0,
		// Keep the skeleton visible for at least 500ms to avoid a flash
		defaultPendingMinMs: 500,
		defaultPendingComponent: PendingComponent,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient });

	return router;
};
