import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, History, LayoutDashboard, LogOut, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout, useUser } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
	{ label: "Dashboard", href: "/", icon: LayoutDashboard },
	{ label: "Leads", href: "/leads", icon: Users },
	{ label: "Templates", href: "/templates", icon: FileText },
	{ label: "Logs", href: "/logs", icon: History },
	{ label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar({ className }: { className?: string }) {
	const router = useRouterState();
	const { mutate: logout } = useLogout();
	const { data: user } = useUser();

	return (
		<div className={cn("flex h-full flex-col border-r bg-card", className)}>
			<div className="p-6">
				<div className="flex items-center gap-2 font-mono text-lg font-bold uppercase tracking-tighter">
					<div className="h-6 w-6 bg-primary rounded-sm" />
					<span>Pivotr Mailer</span>
				</div>
			</div>

			<div className="flex-1 px-4 py-2">
				<nav className="space-y-1">
					{NAV_ITEMS.map((item) => {
						const isActive = router.location.pathname === item.href;
						return (
							<Link
								key={item.href}
								to={item.href}
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
									isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
								)}
							>
								<item.icon className="h-4 w-4" />
								{item.label}
							</Link>
						);
					})}
				</nav>
			</div>

			<div className="border-t p-4">
				<div className="flex items-center gap-3 px-3 py-2 mb-2">
					<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs">
						{user?.name?.substring(0, 2).toUpperCase() || "U"}
					</div>
					<div className="overflow-hidden">
						<p className="truncate text-sm font-medium">{user?.name}</p>
						<p className="truncate text-xs text-muted-foreground">{user?.email}</p>
					</div>
				</div>
				<Button
					variant="ghost"
					className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
					onClick={() => logout()}
				>
					<LogOut className="h-4 w-4" />
					Logout
				</Button>
			</div>
		</div>
	);
}
