import { createFileRoute } from "@tanstack/react-router";
import { TemplateEditor } from "@/features/templates/components/template-editor";

export const Route = createFileRoute("/templates")({
	component: TemplatesPage,
});

function TemplatesPage() {
	return (
		<div className="p-6 max-w-[1600px] mx-auto h-full space-y-4">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-bold tracking-tight">Template Editor</h1>
				<p className="text-muted-foreground">
					Design your email campaign with Spintax support and real-time preview.
				</p>
			</div>

			<TemplateEditor />
		</div>
	);
}
