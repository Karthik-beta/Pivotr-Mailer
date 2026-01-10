import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

interface LayoutProps {
    children: React.ReactNode
    breadcrumbs?: React.ReactNode
}

export function Layout({ children, breadcrumbs }: LayoutProps) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbs ? (
                                    breadcrumbs
                                ) : (
                                    // Default breadcrumbs if none provided
                                    <>
                                        <BreadcrumbItem className="hidden md:block">
                                            <BreadcrumbLink href="/">
                                                Pivotr Mailer
                                            </BreadcrumbLink>
                                        </BreadcrumbItem>
                                    </>
                                )}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-2 px-4">
                        <ThemeToggle />
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
