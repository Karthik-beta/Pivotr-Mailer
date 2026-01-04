import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginForm } from "@/features/auth/components/login-form";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	component: LoginPage,
	validateSearch: searchSchema,
});

function LoginPage() {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-background overflow-hidden relative animate-in fade-in duration-200">
			{/* Subtle grid pattern background with gradient fade */}
			<div
				className="absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: `
						linear-gradient(to right, currentColor 1px, transparent 1px),
						linear-gradient(to bottom, currentColor 1px, transparent 1px)
					`,
					backgroundSize: "40px 40px",
					maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 10%, transparent 70%)",
					WebkitMaskImage:
						"radial-gradient(ellipse 80% 80% at 50% 50%, black 10%, transparent 70%)",
				}}
			/>

			{/* Subtle glow accent */}
			<div
				className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-[0.08] blur-3xl pointer-events-none"
				style={{
					background: "radial-gradient(ellipse at center, #61DAFB 0%, transparent 70%)",
				}}
			/>

			{/* Login form container */}
			<div className="relative z-10">
				<LoginForm />
			</div>
		</div>
	);
}
