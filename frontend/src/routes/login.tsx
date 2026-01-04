import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
	redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
	component: LoginPage,
	validateSearch: searchSchema,
});

function LoginPage() {
	return (
		<div className="flex h-screen w-full items-center justify-center bg-background">
			<div className="w-full max-w-sm border border-border bg-card p-6 shadow-xl rounded-xl">
				<h1 className="text-2xl font-bold mb-6 font-mono text-center uppercase tracking-tight">
					Pivotr Mailer
				</h1>
				<div className="text-center text-muted-foreground">Auth Form Component</div>
			</div>
		</div>
	);
}
