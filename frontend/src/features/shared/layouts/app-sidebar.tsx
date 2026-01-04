import { Link, useRouterState } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	FileText,
	History,
	LayoutDashboard,
	LogOut,
	Settings,
	Users,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLogout, useSyncGoogleAvatar, useUser } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
	{ label: "Dashboard", href: "/", icon: LayoutDashboard },
	{ label: "Leads", href: "/leads", icon: Users },
	{ label: "Templates", href: "/templates", icon: FileText },
	{ label: "Logs", href: "/logs", icon: History },
	{ label: "Settings", href: "/settings", icon: Settings },
];

interface AppSidebarProps {
	className?: string;
	isCollapsed?: boolean;
	toggleSidebar?: () => void;
}

export function AppSidebar({ className, isCollapsed = false, toggleSidebar }: AppSidebarProps) {
	const router = useRouterState();
	const { mutate: logout } = useLogout();
	const { data: user } = useUser();
	useSyncGoogleAvatar();

	const userInitials = user?.name?.substring(0, 2).toUpperCase() || "U";
	const userAvatar = user?.prefs?.avatar;

	return (
		<div
			className={cn("flex h-full flex-col border-r bg-card transition-all duration-300", className)}
		>
			<div className="flex h-14 items-center justify-between px-4 border-b">
				{!isCollapsed && (
					<div className="flex items-center gap-2 font-mono text-lg font-bold uppercase tracking-tighter overflow-hidden whitespace-nowrap">
						<div className="h-6 w-6 bg-primary rounded-sm flex-shrink-0" />
						<span className="truncate">Pivotr Mailer</span>
					</div>
				)}
				{isCollapsed && (
					<div className="flex w-full justify-center">
						<div className="h-6 w-6 bg-primary rounded-sm shadow-sm" />
					</div>
				)}

				{toggleSidebar && !isCollapsed && (
					<Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={toggleSidebar}>
						<ChevronLeft className="h-4 w-4" />
					</Button>
				)}
			</div>
			{/* Toggle button for collapsed state - placed outside header or inside specially */}
			{isCollapsed && toggleSidebar && (
				<div className="flex justify-center py-2 border-b">
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleSidebar}>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			)}

			<div className="flex-1 px-3 py-4 overflow-x-hidden">
				<nav className="space-y-2">
					<TooltipProvider delayDuration={0}>
						{NAV_ITEMS.map((item) => {
							const isActive = router.location.pathname === item.href;
							return (
								<div key={item.href}>
									{isCollapsed ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Link
													to={item.href}
													className={cn(
														"flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
														isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
													)}
												>
													<item.icon className="h-4 w-4" />
												</Link>
											</TooltipTrigger>
											<TooltipContent side="right" className="flex items-center gap-4">
												{item.label}
											</TooltipContent>
										</Tooltip>
									) : (
										<Link
											to={item.href}
											className={cn(
												"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
												isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
											)}
										>
											<item.icon className="h-4 w-4" />
											<span className="truncate">{item.label}</span>
										</Link>
									)}
								</div>
							);
						})}
					</TooltipProvider>
				</nav>
			</div>

			<div className="border-t p-4 transition-all duration-300">
				{!isCollapsed ? (
					<>
						<div className="flex items-center justify-between mb-2 px-1">
							<div className="text-xs font-semibold text-muted-foreground uppercase">User</div>
							<ModeToggle />
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div className="flex items-center gap-3 px-3 py-2 mb-2 bg-muted/50 rounded-md cursor-pointer hover:bg-muted transition-colors group">
									<Avatar className="h-8 w-8 ring-1 ring-border shrink-0">
										<AvatarImage src={userAvatar} alt={user?.name} referrerPolicy="no-referrer" />
										<AvatarFallback className="bg-background text-xs font-bold">
											{userInitials}
										</AvatarFallback>
									</Avatar>
									<div className="overflow-hidden flex-1">
										<p className="truncate text-sm font-medium">{user?.name}</p>
										<p className="truncate text-xs text-muted-foreground">{user?.email}</p>
									</div>
									<ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-[240px]" side="right" sideOffset={10}>
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage src={userAvatar} alt={user?.name} />
										<AvatarFallback className="rounded-lg">CN</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user?.name}</span>
										<span className="truncate text-xs">{user?.email}</span>
									</div>
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuItem disabled>
									<Users className="mr-2 h-4 w-4" />
									<span>Profile</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive cursor-pointer"
									onClick={() => logout()}
								>
									<LogOut className="mr-2 h-4 w-4" />
									<span>Logout</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<div className="flex flex-col items-center gap-4">
						<ModeToggle />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div className="cursor-pointer">
									<Avatar className="h-8 w-8 ring-1 ring-border">
										<AvatarImage src={userAvatar} alt={user?.name} referrerPolicy="no-referrer" />
										<AvatarFallback className="bg-muted text-xs font-bold">
											{userInitials}
										</AvatarFallback>
									</Avatar>
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="right" align="end" sideOffset={10}>
								<DropdownMenuLabel>My Account</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem disabled>
									<Users className="mr-2 h-4 w-4" />
									<span>Profile</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive cursor-pointer"
									onClick={() => logout()}
								>
									<LogOut className="mr-2 h-4 w-4" />
									<span>Logout</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				)}
			</div>
		</div>
	);
}
