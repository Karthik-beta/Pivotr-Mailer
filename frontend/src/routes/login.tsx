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
		<div className="flex h-screen w-full items-center justify-center bg-background">
			<LoginForm />
		</div>
	);
}
