import { Outlet, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { RecoveryBanner } from "@/features/system/components/recovery-banner";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { AuthGuard } from "./auth-guard";

export function RootLayout() {
	const router = useRouterState();
	const isLoginPage = router.location.pathname === "/login";
	const { isCollapsed, toggleSidebar } = useSidebar();

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

	return (
		<div className="min-h-screen font-sans antialiased">
			<AuthGuard>
				<div
					className={cn(
						"grid h-screen w-full transition-all duration-300 ease-in-out overflow-hidden",
						isCollapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[280px_1fr]"
					)}
				>
					<div className="hidden border-r bg-muted/40 lg:block transition-all duration-300 ease-in-out overflow-hidden">
						<AppSidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
					</div>
					<div className="flex flex-col h-full overflow-hidden">
						<RecoveryBanner />
						<AppHeader />
						<div className="flex-1 overflow-y-auto p-0">
							<Outlet />
						</div>
					</div>
				</div>
			</AuthGuard>
			<Toaster />
		</div>
	);
}
