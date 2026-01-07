import { TanStackDevtools } from "@tanstack/react-devtools";
// force-regen
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ArrowLeft, Compass } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
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
	notFoundComponent: NotFoundPage,
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

function NotFoundPage() {
	return (
		<div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
			{/* Animated compass icon */}
			<div className="relative mb-8">
				<div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-150" />
				<div className="relative bg-card border rounded-2xl p-6 shadow-lg">
					<Compass className="h-16 w-16 text-muted-foreground animate-[spin_8s_ease-in-out_infinite]" />
				</div>
			</div>

			{/* 404 text */}
			<div className="space-y-3 mb-8">
				<h1 className="text-8xl font-bold tracking-tighter text-foreground/10 select-none">
					404
				</h1>
				<h2 className="text-2xl font-semibold tracking-tight -mt-14 relative">
					Page not found
				</h2>
				<p className="text-muted-foreground max-w-md mx-auto">
					The page you're looking for doesn't exist or has been moved.
					Let's get you back on track.
				</p>
			</div>

			{/* Action button */}
			<Link to="/">
				<Button variant="outline" size="lg" className="gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back to Dashboard
				</Button>
			</Link>
		</div>
	);
}
