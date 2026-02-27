import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface LayoutProps {
	children: React.ReactNode;
	breadcrumbs?: React.ReactNode;
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="relative overflow-hidden">
				{/* Grid pattern background - only in main content, not sidebar */}
				<GridPattern className="z-0" />
				<header className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
						<Breadcrumb>
							<BreadcrumbList>
								{breadcrumbs ? (
									breadcrumbs
								) : (
									// Default breadcrumbs if none provided
									<BreadcrumbItem className="hidden md:block">
										<BreadcrumbLink asChild>
											<Link to="/">Pivotr Mailer</Link>
										</BreadcrumbLink>
									</BreadcrumbItem>
								)}
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<div className="flex items-center gap-2 px-4">
						<ThemeToggle />
					</div>
				</header>
				<div className="relative z-10 flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
