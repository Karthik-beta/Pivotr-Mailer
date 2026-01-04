import { Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { RecoveryBanner } from "@/features/system/components/recovery-banner";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { AuthGuard } from "./auth-guard";

export function RootLayout() {
	const router = useRouterState();
	const isLoginPage = router.location.pathname === "/login";

	if (isLoginPage) {
		return (
			<div className="min-h-screen bg-background font-sans antialiased">
				<AuthGuard>
					<Outlet />
				</AuthGuard>
				<Toaster />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background font-sans antialiased">
			<AuthGuard>
				<div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
					<div className="hidden border-r bg-muted/40 lg:block">
						<AppSidebar />
					</div>
					<div className="flex flex-col">
						<RecoveryBanner />
						<AppHeader />
						<div className="flex-1">
							<Outlet />
						</div>
					</div>
				</div>
			</AuthGuard>
			<Toaster />
		</div>
	);
}
