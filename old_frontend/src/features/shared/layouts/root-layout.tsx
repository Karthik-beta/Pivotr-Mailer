import { Outlet, useRouterState } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useLogoutState, useTransitioningState } from "@/features/auth/hooks";
import { RecoveryBanner } from "@/features/system/components/recovery-banner";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { AuthGuard } from "./auth-guard";

export function RootLayout() {
	const router = useRouterState();
	const isLoginPage = router.location.pathname === "/login";
	const isLoggingOut = useLogoutState();
	const isTransitioning = useTransitioningState();

	// During logout or transition, render only the loader without Outlet
	// This prevents any content flash during the logout animation
	if (isLoggingOut || isTransitioning) {
		return (
			<div className="min-h-screen font-sans antialiased">
				<AuthGuard>{null}</AuthGuard>
				<Toaster />
			</div>
		);
	}

	// Login page - simple wrapper without app shell
	if (isLoginPage) {
		return (
			<div className="min-h-screen font-sans antialiased">
				<AuthGuard>
					<Outlet />
				</AuthGuard>
				<Toaster />
			</div>
		);
	}

	// Authenticated app - full layout with shadcn sidebar
	return (
		<div className="min-h-screen font-sans antialiased">
			<AuthGuard>
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset className="bg-transparent">
						<RecoveryBanner />
						<AppHeader />
						<div className="flex-1 overflow-y-auto p-0 bg-transparent">
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
			</AuthGuard>
			<Toaster />
		</div>
	);
}
