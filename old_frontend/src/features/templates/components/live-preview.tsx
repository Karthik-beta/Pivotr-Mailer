import { resolveSpintax, validateSpintax } from "@shared/spintax/resolver";
import {
	buildTemplateVariables,
	injectVariables,
	templateVariablesToMap,
} from "@shared/spintax/variable-injector";
import type { Lead } from "@shared/types/lead.types";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LivePreviewProps {
	subjectTemplate: string;
	bodyTemplate: string;
	lead: Lead | null;
	isLoadingLead?: boolean;
}

export function LivePreview({
	subjectTemplate,
	bodyTemplate,
	lead,
	isLoadingLead,
}: LivePreviewProps) {
	const preview = useMemo(() => {
		// 1. Resolve Spintax
		const subjectResolved = resolveSpintax(subjectTemplate);
		const bodyResolved = resolveSpintax(bodyTemplate);

		// 2. Inject Variables
		// Mock lead if none provided
		const mockLead: Lead = {
			$id: "mock",
			$createdAt: "",
			$updatedAt: "",
			email: "john.doe@example.com",
			fullName: "John Doe",
			parsedFirstName: "John",
			companyName: "Acme Corp",
			status: "VERIFIED",
			verificationResult: "ok",
			campaignId: "mock",
			history: [],
		} as unknown as Lead;

		const targetLead = lead || mockLead;
		const vars = buildTemplateVariables(targetLead, "http://unsubscribe.example.com");
		const varMap = templateVariablesToMap(vars);

		const subjectFinal = injectVariables(subjectResolved, varMap);
		const bodyFinal = injectVariables(bodyResolved, varMap);

		// Spintax Validation Errors
		const subjectErrors = validateSpintax(subjectTemplate);
		const bodyErrors = validateSpintax(bodyTemplate);

		return {
			subject: subjectFinal,
			body: bodyFinal,
			errors: [...subjectErrors, ...bodyErrors],
			isMock: !lead,
		};
	}, [subjectTemplate, bodyTemplate, lead]);

	if (isLoadingLead) {
		return <Skeleton className="h-[400px] w-full" />;
	}

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="pb-3 border-b bg-muted/20">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
						Live Preview
					</CardTitle>
					{preview.isMock && (
						<span className="text-xs text-amber-500 font-mono">(Using Mock Data)</span>
					)}
				</div>
				{preview.errors.length > 0 && (
					<div className="mt-2 p-2 bg-destructive/10 text-destructive text-xs rounded-md border border-destructive/20 flex gap-2">
						<AlertCircle className="h-4 w-4 shrink-0" />
						<div className="space-y-1">
							{preview.errors.map((err, i) => (
								<div key={`error-${i}`}>{err}</div>
							))}
						</div>
					</div>
				)}
			</CardHeader>
			<CardContent className="flex-1 p-0 overflow-y-auto bg-white dark:bg-zinc-950">
				{/* Email Simulation Header */}
				<div className="p-4 border-b space-y-2 bg-background">
					<div className="text-sm">
						<span className="text-muted-foreground font-medium w-16 inline-block">To:</span>
						<span>{lead?.email || "john.doe@example.com"}</span>
					</div>
					<div className="text-sm">
						<span className="text-muted-foreground font-medium w-16 inline-block">Subject:</span>
						<span className="font-semibold">{preview.subject}</span>
					</div>
				</div>

				{/* Email Body */}
				<div
					className="p-6 prose prose-sm dark:prose-invert max-w-none"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Trusted content from internal template engine
					dangerouslySetInnerHTML={{ __html: preview.body.replace(/\n/g, "<br/>") }}
				/>
			</CardContent>
		</Card>
	);
}
