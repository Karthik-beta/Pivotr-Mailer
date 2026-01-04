import { useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar, NAV_ITEMS } from "./app-sidebar";

export function AppHeader() {
	const router = useRouterState();
	const currentPath = router.location.pathname;
	const currentTitle =
		NAV_ITEMS.find((item) => item.href === currentPath)?.label || "Pivotr Mailer";

	return (
		<header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
			<Sheet>
				<SheetTrigger asChild>
					<Button variant="ghost" size="icon" className="lg:hidden">
						<Menu className="h-5 w-5" />
						<span className="sr-only">Toggle navigation menu</span>
					</Button>
				</SheetTrigger>
				<SheetContent side="left" className="p-0 w-64">
					<AppSidebar className="border-none" />
				</SheetContent>
			</Sheet>
			<div className="flex-1 font-semibold">{currentTitle}</div>
		</header>
	);
}
