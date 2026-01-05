import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	resetLogoutState,
	setTransitioning,
	useLogoutState,
	useTransitioningState,
	useUser,
} from "@/features/auth/hooks";

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const { data: user, isLoading } = useUser();
	const isLoggingOut = useLogoutState();
	const navigate = useNavigate();
	const routerState = useRouterState();

	const isLoginPage = routerState.location.pathname === "/login";
	const isTransitioning = useTransitioningState();

	/**
	 * Logout Transition Handler
	 * When reaching login page during logout, orchestrates the transition:
	 * 1. Sets transitioning=true to keep RootLayout in loader mode
	 * 2. Uses triple requestAnimationFrame for stable DOM paint cycles
	 * 3. Resets logout state, then transitioning state to reveal login page
	 */
	useEffect(() => {
		if (isLoginPage && isLoggingOut) {
			setTransitioning(true);
			const frameId = requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					resetLogoutState();
					requestAnimationFrame(() => {
						setTransitioning(false);
					});
				});
			});
			return () => cancelAnimationFrame(frameId);
		}
	}, [isLoginPage, isLoggingOut]);

	useEffect(() => {
		// Don't navigate during logout - the logout handler does this
		if (!isLoading && !isLoggingOut) {
			if (!user && !isLoginPage) {
				navigate({ to: "/login", search: { redirect: routerState.location.href } });
			} else if (user && isLoginPage) {
				navigate({ to: "/" });
			}
		}
	}, [user, isLoading, isLoggingOut, isLoginPage, navigate, routerState.location.href]);

	if (isLoading || isLoggingOut || isTransitioning) {
		return (
			<div className="h-screen w-full flex items-center justify-center bg-background overflow-hidden relative animate-in fade-in duration-200">
				<div
					className="absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: `
							linear-gradient(to right, currentColor 1px, transparent 1px),
							linear-gradient(to bottom, currentColor 1px, transparent 1px)
						`,
						backgroundSize: "40px 40px",
						maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)",
						WebkitMaskImage:
							"radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 70%)",
					}}
				/>

				<div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
					<div className="relative">
						<div className="absolute inset-0 blur-2xl opacity-30 animate-pulse bg-[#61DAFB] rounded-full scale-150" />
						<img
							src="/image.png"
							alt="Pivotr Mailer"
							className="w-16 h-16 relative z-10 animate-pulse"
							style={{ animationDuration: "2s" }}
						/>
					</div>

					<div className="text-center space-y-1">
						<h1 className="text-lg font-semibold tracking-tight text-foreground/90">
							Pivotr Mailer
						</h1>
						<p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
							Initializing
						</p>
					</div>

					<div className="w-48 h-0.5 bg-border/50 rounded-full overflow-hidden">
						<div
							className="h-full bg-[#61DAFB] rounded-full"
							style={{
								width: "30%",
								animation: "loading 1.5s ease-in-out infinite",
							}}
						/>
					</div>
				</div>

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

	if (isLoginPage && !user) {
		return <div className="animate-in fade-in duration-200">{children}</div>;
	}

	if (user) {
		return <div className="animate-in fade-in duration-200">{children}</div>;
	}

	return null;
}
