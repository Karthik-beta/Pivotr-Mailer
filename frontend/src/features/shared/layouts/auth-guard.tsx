import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
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
			<div className="h-screen w-full flex items-center justify-center bg-background overflow-hidden relative">
				{/* Subtle grid pattern background with gradient fade */}
				<div
					className="absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(to right, currentColor 1px, transparent 1px),
							linear-gradient(to bottom, currentColor 1px, transparent 1px)
						`,
						backgroundSize: "40px 40px",
						maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)",
						WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)",
					}}
				/>

				{/* Main loader container */}
				<div className="relative z-10 flex flex-col items-center gap-6">
					{/* Logo with pulse animation */}
					<div className="relative">
						<div className="absolute inset-0 blur-2xl opacity-30 animate-pulse bg-[#61DAFB] rounded-full scale-150" />
						<img
							src="/image.png"
							alt="Pivotr Mailer"
							className="w-16 h-16 relative z-10 animate-pulse"
							style={{ animationDuration: "2s" }}
						/>
					</div>

					{/* Brand text */}
					<div className="text-center space-y-1">
						<h1 className="text-lg font-semibold tracking-tight text-foreground/90">
							Pivotr Mailer
						</h1>
						<p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
							Initializing
						</p>
					</div>

					{/* Animated progress bar */}
					<div className="w-48 h-0.5 bg-border/50 rounded-full overflow-hidden">
						<div
							className="h-full bg-[#61DAFB] rounded-full animate-[loading_1.5s_ease-in-out_infinite]"
							style={{
								width: "30%",
								animation: "loading 1.5s ease-in-out infinite",
							}}
						/>
					</div>
				</div>

				{/* CSS keyframes for loading animation */}
				<style>
					{`
						@keyframes loading {
							0% {
								transform: translateX(-100%);
							}
							50% {
								transform: translateX(250%);
							}
							100% {
								transform: translateX(-100%);
							}
						}
					`}
				</style>
			</div>
		);
	}

	// If on login page and not user, render login
	if (isLoginPage && !user) return <>{children}</>;

	// If authorized, render children
	if (user) return <>{children}</>;

	return null;
}
