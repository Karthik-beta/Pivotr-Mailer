"use client";

import { BarChart3, LayoutDashboard, Mail, Settings2, Users } from "lucide-react";
import type * as React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

const data = {
	user: {
		name: "Admin",
		email: "admin@pivotr.in",
		avatar: "/avatars/admin.jpg",
	},
	navMain: [
		{
			title: "Dashboard",
			url: "/",
			icon: LayoutDashboard,
			isActive: false,
			items: [
				{
					title: "Overview",
					url: "/",
				},
				{
					title: "Analytics",
					url: "/analytics",
				},
			],
		},
		{
			title: "Leads",
			url: "/leads",
			icon: Users,
			items: [
				{
					title: "All Leads",
					url: "/leads",
				},
				{
					title: "Import / Staging",
					url: "/leads/staging",
				},
			],
		},
		{
			title: "Campaigns",
			url: "/campaigns",
			icon: Mail,
			items: [
				{
					title: "All Campaigns",
					url: "/campaigns",
				},
				{
					title: "Create Campaign",
					url: "/campaigns/new",
				},
			],
		},
		{
			title: "Reports",
			url: "/reports",
			icon: BarChart3,
			items: [
				{
					title: "Delivery Stats",
					url: "/reports/delivery",
				},
				{
					title: "Engagement",
					url: "/reports/engagement",
				},
			],
		},
		{
			title: "Settings",
			url: "/settings",
			icon: Settings2,
			items: [
				{
					title: "General",
					url: "/settings",
				},
				{
					title: "Email Config",
					url: "/settings/email",
				},
				{
					title: "API Keys",
					url: "/settings/api",
				},
			],
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="h-14 border-b p-0 justify-center">
				<div className="flex items-center gap-2 px-3 w-full">
					<div className="size-6 shrink-0 flex items-center justify-center relative">
						<img
							src="/image.png"
							alt="Pivotr Mailer Logo"
							className="size-6 object-contain absolute inset-0"
						/>
					</div>
					<span className="font-bold uppercase tracking-tight text-sm group-data-[state=collapsed]:hidden whitespace-nowrap overflow-hidden">
						Pivotr Mailer
					</span>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
