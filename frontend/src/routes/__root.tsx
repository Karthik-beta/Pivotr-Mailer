import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "../components/theme-provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { Provider } from "../integrations/tanstack-query/root-provider";
import StoreDevtools from "../lib/demo-store-devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

import NotFoundPage from "../components/NotFoundPage";
import { Layout } from "../features/shared/Layout";

export const Route = createRootRouteWithContext<MyRouterContext>()({
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

function RootDocument({ children }: { children: React.ReactNode }) {
	const themeScript = `
              (function() {
                try {
                  var config = JSON.parse(localStorage.getItem('pivotr-theme-config') || '{}');
                  var mode = config.mode || 'system';
                  var isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script
					dangerouslySetInnerHTML={{
						__html: themeScript,
					}}
				/>
			</head>
			<body>
				<ThemeProvider>{children}</ThemeProvider>
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
