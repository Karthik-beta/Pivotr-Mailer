import { createFileRoute } from "@tanstack/react-router";

import NotFoundPage from "@/components/NotFoundPage";

export const Route = createFileRoute("/$notFound")({
	component: RouteComponent,
});

function RouteComponent() {
	return <NotFoundPage />;
}
