import { Link, useRouterState } from "@tanstack/react-router";
import {
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	// SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import { useLogout, useSyncGoogleAvatar, useUser } from "@/features/auth/hooks";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
	{ label: "Dashboard", href: "/", icon: LayoutDashboard },
	{ label: "Leads", href: "/leads", icon: Users },
	{ label: "Templates", href: "/templates", icon: FileText },
	{ label: "Logs", href: "/logs", icon: History },
	{ label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
	const { mutate: logout } = useLogout();
	const { data: user } = useUser();
	useSyncGoogleAvatar();
	const router = useRouterState();
	const { state, toggleSidebar } = useSidebar();

	const userInitials = user?.name?.substring(0, 2).toUpperCase() || "U";
	const userAvatar = user?.prefs?.avatar;
	const isCollapsed = state === "collapsed";

	return (
		<Sidebar
			collapsible="icon"
			style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
			className={cn(isCollapsed && "cursor-e-resize")}
			onClick={() => {
				if (isCollapsed) {
					toggleSidebar();
				}
			}}
		>
			<SidebarHeader className="h-14 border-b flex flex-row items-center justify-between px-3 group/header">
				<div className="flex items-center gap-2">
					<div className="size-6 shrink-0 flex items-center justify-center relative">
						<img
							src="/image.png"
							alt="Pivotr Mailer Logo"
							className="size-6 object-contain absolute inset-0 transition-opacity group-data-[collapsible=icon]:group-hover/header:opacity-0"
						/>
						<SidebarTrigger className="hidden group-data-[state=collapsed]:group-hover/header:flex size-6 p-0 [&>svg]:size-4 cursor-e-resize absolute inset-0" />
					</div>
					<span className="font-bold uppercase tracking-tight text-sm group-data-[state=collapsed]:hidden whitespace-nowrap overflow-hidden">
						Pivotr Mailer
					</span>
				</div>
				<SidebarTrigger className="group-data-[state=collapsed]:hidden shrink-0 cursor-e-resize" />
			</SidebarHeader>

			<SidebarContent className="pt-4">
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className="gap-2">
							{NAV_ITEMS.map((item) => {
								const isActive = router.location.pathname === item.href;
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={item.label}
											className="h-10 text-base [&>svg]:size-5"
										>
											<Link to={item.href}>
												<item.icon />
												<span>{item.label}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:hidden">
							<span className="text-xs font-semibold text-muted-foreground uppercase">User</span>
							<ModeToggle />
						</div>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage src={userAvatar} alt={user?.name} referrerPolicy="no-referrer" />
										<AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">{user?.name}</span>
										<span className="truncate text-xs">{user?.email}</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
								side="right"
								align="end"
								sideOffset={4}
							>
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarImage src={userAvatar} alt={user?.name} />
										<AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
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
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			{/* <SidebarRail /> */}
		</Sidebar>
	);
}
