import { useRouterState } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NAV_ITEMS } from "./app-sidebar";

/**
 * Mobile header with sidebar trigger - visible only on small screens
 */
export function AppHeader() {
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const currentTitle =
		NAV_ITEMS.find((item) => item.href === currentPath)?.label || "Pivotr Mailer";

	return (
		<header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
			<SidebarTrigger />
			<div className="flex-1 font-semibold">{currentTitle}</div>
		</header>
	);
}
