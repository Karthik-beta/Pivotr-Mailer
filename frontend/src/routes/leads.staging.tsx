import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/leads/staging")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/leads/staging"!</div>;
}
