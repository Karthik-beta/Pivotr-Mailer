import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";

import { ThemeProvider } from "../components/theme-provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { Provider } from "../integrations/tanstack-query/root-provider";
import { getThemeFromCookie, resolveEffectiveTheme } from "../lib/cookies";
import StoreDevtools from "../lib/demo-store-devtools";
import { initializeThemeStore } from "../lib/theme/store";
import type { ThemeMode } from "../lib/theme/types";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
	/** Initial theme mode from cookie (set by server) */
	initialThemeMode?: ThemeMode | null;
}

import NotFoundPage from "../components/NotFoundPage";
import { Layout } from "../features/shared/Layout";

/**
 * Server function to get theme from cookie.
 * Uses createServerFn to ensure it runs on the server only.
 */
const getThemeFromServer = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const { getStartContext } = await import("@tanstack/start-storage-context");
		const startContext = getStartContext({ throwIfNotFound: false });
		const cookieHeader = startContext?.request.headers.get("cookie") ?? undefined;
		return getThemeFromCookie(cookieHeader);
	} catch {
		return null;
	}
});

export const Route = createRootRouteWithContext<MyRouterContext>()({
	// Load initial theme on server before rendering
	beforeLoad: async () => {
		// Only run on server
		if (typeof window !== "undefined") {
			return { initialThemeMode: null };
		}

		try {
			const initialThemeMode = await getThemeFromServer();
			return { initialThemeMode };
		} catch {
			return { initialThemeMode: null };
		}
	},

	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Pivotr Mailer",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/image.png",
			},
		],
	}),

	component: RootComponent,
	shellComponent: RootDocument,
	notFoundComponent: () => (
		<Layout>
			<NotFoundPage />
		</Layout>
	),
});

function RootComponent() {
	const { queryClient } = Route.useRouteContext();
	return (
		<Provider queryClient={queryClient}>
			<HydrationBoundary state={dehydrate(queryClient)}>
				<Outlet />
			</HydrationBoundary>
		</Provider>
	);
}

/**
 * RootDocument handles SSR theme initialization.
 *
 * Security: No inline scripts or dangerouslySetInnerHTML.
 * CSP Compliance: Works with script-src 'self'.
 *
 * Theme Flow:
 * 1. Server reads theme from cookie in beforeLoad
 * 2. Server passes initialThemeMode via route context
 * 3. Server applies correct class to <html> element
 * 4. Client hydrates with matching state (no flash)
 * 5. ThemeProvider syncs with store and handles client-side changes
 */
function RootDocument({ children }: { children: React.ReactNode }) {
	const isServer = typeof window === "undefined";
	const context = Route.useRouteContext();
	const initialMode: ThemeMode | null = context.initialThemeMode ?? null;

	// Resolve effective theme for SSR
	// On server, we can't detect system preference, so default to light for "system"
	const effectiveTheme = isServer ? resolveEffectiveTheme(initialMode ?? "system", false) : null; // Client doesn't need this, html class is already set

	// Initialize the store with the server-determined mode
	if (isServer && initialMode !== null) {
		initializeThemeStore(initialMode);
	}

	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={effectiveTheme === "dark" ? "dark" : undefined}
		>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider initialMode={initialMode}>{children}</ThemeProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						StoreDevtools,
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
