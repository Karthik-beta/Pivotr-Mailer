import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/features/auth/hooks";

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const { data: user, isLoading } = useUser();
	const navigate = useNavigate();
	const routerState = useRouterState();

	const isLoginPage = routerState.location.pathname === "/login";

	useEffect(() => {
		if (!isLoading) {
			if (!user && !isLoginPage) {
				navigate({ to: "/login", search: { redirect: routerState.location.href } });
			} else if (user && isLoginPage) {
				navigate({ to: "/" });
			}
		}
	}, [user, isLoading, isLoginPage, navigate, routerState.location.href]);

	if (isLoading) {
		return (
			<div className="h-screen w-full flex items-center justify-center bg-background">
				<div className="space-y-4 w-64">
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-4 w-3/4 mx-auto" />
				</div>
			</div>
		);
	}

	// If on login page and not user, render login
	if (isLoginPage && !user) return <>{children}</>;

	// If authorized, render children
	if (user) return <>{children}</>;

	return null;
}
