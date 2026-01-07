import { TanStackDevtools } from "@tanstack/react-devtools";
// force-regen
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { GridPattern } from "@/components/ui/grid-pattern";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RootLayout } from "@/features/shared/layouts/root-layout";

import appCss from "../styles.css?url";

/**
 * Render devtools only after client hydration completes.
 *
 * TanStackDevtools auto-detects @tanstack/react-query and calls useQueryClient()
 * during render. This hook throws "No QueryClient set" during SSR because
 * QueryClientProvider context isn't available until hydration.
 */
function ClientOnlyDevtools() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;

	return (
		<TanStackDevtools
			config={{
				position: "bottom-right",
			}}
			plugins={[
				{
					name: "Tanstack Router",
					render: <TanStackRouterDevtoolsPanel />,
				},
			]}
		/>
	);
}

// Define the router context type
interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
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
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/image.png",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument() {
	// Get the queryClient from router context
	const router = useRouter();
	const queryClient = router.options.context.queryClient;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="bg-background font-sans antialiased text-foreground min-h-screen">
				<ThemeProvider attribute="class" defaultTheme="dark" storageKey="vite-ui-theme">
					<GridPattern className="fixed inset-0 z-[-1]" />
					<QueryClientProvider client={queryClient}>
						<TooltipProvider>
							<RootLayout />
						</TooltipProvider>
						<ClientOnlyDevtools />
					</QueryClientProvider>
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}
