import { Link, useRouterState } from "@tanstack/react-router";
import type { Models } from "appwrite";
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
	const { mutate: logout } = useLogout();
	const { data: user } = useUser();
	useSyncGoogleAvatar();

	const userInitials = user?.name?.substring(0, 2).toUpperCase() || "U";
	const userAvatar = user?.prefs?.avatar;

	return (
		<aside
			className={cn(
				"flex h-full flex-col border-r bg-card transition-all duration-300 group",
				isCollapsed ? "cursor-ew-resize" : "w-full",
				className
			)}
			onClick={() => isCollapsed && toggleSidebar && toggleSidebar()}
			onKeyDown={(e) => {
				if (isCollapsed && toggleSidebar && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					toggleSidebar();
				}
			}}
			role={isCollapsed ? "button" : undefined}
			tabIndex={isCollapsed ? 0 : undefined}
			aria-label={isCollapsed ? "Expand sidebar" : "Sidebar"}
		>
			<SidebarHeader isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
			<SidebarNav isCollapsed={isCollapsed} />
			<SidebarFooter
				isCollapsed={isCollapsed}
				user={user}
				userInitials={userInitials}
				userAvatar={userAvatar}
				logout={logout}
			/>
		</aside>
	);
}

function SidebarHeader({
	isCollapsed,
	toggleSidebar,
}: {
	isCollapsed: boolean;
	toggleSidebar?: () => void;
}) {
	return (
		<div
			className={cn(
				"flex h-14 items-center border-b transition-all duration-300 overflow-hidden",
				isCollapsed ? "px-0 justify-center" : "px-4 justify-between"
			)}
		>
			<div
				className={cn(
					"flex items-center font-mono text-lg font-bold uppercase tracking-tighter whitespace-nowrap overflow-hidden transition-all duration-300",
					isCollapsed ? "gap-0" : "gap-2"
				)}
			>
				<div className="relative flex items-center justify-center w-6 h-6 shrink-0">
					<img
						src="/image.png"
						alt="Pivotr Mailer Logo"
						className={cn(
							"h-6 w-6 object-contain transition-opacity duration-300",
							isCollapsed && "group-hover:opacity-20"
						)}
					/>
					<ChevronRight
						className={cn(
							"absolute h-4 w-4 text-primary transition-opacity duration-300",
							isCollapsed ? "opacity-0 group-hover:opacity-100" : "opacity-0 hidden"
						)}
					/>
				</div>

				<span
					className={cn(
						"transition-all duration-300 ease-in-out origin-left overflow-hidden",
						isCollapsed ? "w-0 opacity-0 scale-x-50" : "w-auto opacity-100 scale-x-100"
					)}
				>
					Pivotr Mailer
				</span>
			</div>

			{toggleSidebar && (
				<Button
					variant="ghost"
					size="icon"
					className={cn(
						"h-6 w-6 shrink-0 transition-all duration-300",
						isCollapsed ? "w-0 opacity-0 p-0 overflow-hidden" : "ml-auto w-6 opacity-100"
					)}
					onClick={(e) => {
						e.stopPropagation();
						toggleSidebar();
					}}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
}

function SidebarNav({ isCollapsed }: { isCollapsed: boolean }) {
	const router = useRouterState();
	return (
		<div
			className={cn(
				"flex-1 py-4 overflow-x-hidden transition-all duration-300",
				isCollapsed ? "px-2" : "px-3"
			)}
		>
			<nav className="space-y-2">
				<TooltipProvider delayDuration={200}>
					{NAV_ITEMS.map((item) => {
						const isActive = router.location.pathname === item.href;
						return (
							<div key={item.href} className={cn("flex", isCollapsed && "justify-center")}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Link
											to={item.href}
											className={cn(
												"flex items-center rounded-md transition-all duration-300",
												isCollapsed
													? "h-9 w-9 justify-center"
													: "h-9 px-3 w-full justify-start gap-3",
												isActive
													? "bg-accent text-accent-foreground"
													: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
											)}
										>
											<item.icon className="h-4 w-4 shrink-0" />
											<span
												className={cn(
													"whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out font-medium text-sm",
													isCollapsed
														? "w-0 opacity-0 translate-x-[-10px]"
														: "w-auto opacity-100 translate-x-0"
												)}
											>
												{item.label}
											</span>
										</Link>
									</TooltipTrigger>
									{isCollapsed && (
										<TooltipContent side="right" className="flex items-center gap-4">
											{item.label}
										</TooltipContent>
									)}
								</Tooltip>
							</div>
						);
					})}
				</TooltipProvider>
			</nav>
		</div>
	);
}

function SidebarFooter({
	isCollapsed,
	user,
	userInitials,
	userAvatar,
	logout,
}: {
	isCollapsed: boolean;
	user: Models.User<Models.Preferences> | null | undefined;
	userInitials: string;
	userAvatar?: string;
	logout: () => void;
}) {
	return (
		<div className={cn("border-t transition-all duration-300", isCollapsed ? "p-2 py-4" : "p-4")}>
			<div
				className={cn(
					"flex items-center justify-between mb-2 px-1 transition-all duration-300 overflow-hidden",
					isCollapsed ? "h-0 opacity-0 mb-0 hidden" : "h-auto opacity-100"
				)}
			>
				<div className="text-xs font-semibold text-muted-foreground uppercase">User</div>
				<ModeToggle />
			</div>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-3 rounded-md cursor-pointer hover:bg-muted transition-all duration-200 group bg-muted/50",
							isCollapsed
								? "justify-center p-0 h-9 w-9 bg-transparent hover:bg-accent"
								: "px-3 py-2"
						)}
					>
						<Avatar
							className={cn(
								"ring-1 ring-border shrink-0 transition-all",
								isCollapsed ? "h-6 w-6" : "h-8 w-8"
							)}
						>
							<AvatarImage src={userAvatar} alt={user?.name} referrerPolicy="no-referrer" />
							<AvatarFallback className="bg-background text-xs font-bold">
								{userInitials}
							</AvatarFallback>
						</Avatar>

						<div
							className={cn(
								"overflow-hidden flex-1 transition-all duration-300 ease-in-out",
								isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
							)}
						>
							<p className="truncate text-sm font-medium">{user?.name}</p>
							<p className="truncate text-xs text-muted-foreground">{user?.email}</p>
						</div>

						<ChevronsUpDown
							className={cn(
								"ml-auto size-4 text-muted-foreground group-hover:text-foreground transition-all duration-300",
								isCollapsed ? "w-0 opacity-0 hidden" : "w-4 opacity-100"
							)}
						/>
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
		</div>
	);
}
