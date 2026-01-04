import { AVAILABLE_VARIABLES } from "@shared/spintax/variable-injector";
import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRandomLead } from "@/features/leads/hooks/use-random-lead";
import { useTemplate } from "../hooks/use-template";
import { LivePreview } from "./live-preview";

export function TemplateEditor() {
	const { campaign, isLoading: isLoadingCampaign, saveTemplate, isSaving } = useTemplate();
	const { data: lead, isLoading: isLoadingLead } = useRandomLead();

	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [isDirty, setIsDirty] = useState(false);
	const subjectId = useId();
	const bodyId = useId();

	// Initialize from campaign
	useEffect(() => {
		if (campaign) {
			setSubject(campaign.subjectTemplate || "");
			setBody(campaign.bodyTemplate || "");
		}
	}, [campaign]);

	// Debounced Save Logic
	// Ideally, we'd use a custom debounce hook or similar.
	// For now, I'll rely on manual "Save" button or implement auto-save.
	// Requirement: "Optimistic updates...".
	// I will implement auto-save with debounce.

	const handleSave = useCallback(() => {
		if (campaign && isDirty) {
			saveTemplate({ subjectTemplate: subject, bodyTemplate: body });
			setIsDirty(false);
		}
	}, [campaign, isDirty, subject, body, saveTemplate]);

	// Keyboard shortcut Ctrl+S
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				handleSave();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleSave]);

	if (isLoadingCampaign) {
		return <TemplateEditorSkeleton />;
	}

	if (!campaign) {
		return (
			<div className="p-8 text-center border rounded-lg bg-muted/20">
				<h3 className="text-lg font-semibold">No Active Campaign</h3>
				<p className="text-muted-foreground">Create a campaign to start editing templates.</p>
			</div>
		);
	}

	const insertVariable = (variable: string) => {
		// Simple append for now as getting cursor position in controlled input is tricky without ref
		// Better UX: Insert at cursor. I'll stick to copy-to-clipboard or append?
		// "Click to copy" is safer than naive append.
		navigator.clipboard.writeText(`{{${variable}}}`);
		// Or append to body?
		setBody((prev) => `${prev} {{${variable}}}`);
		setIsDirty(true);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-10rem)]">
			{/* Editor Column */}
			<div className="flex flex-col gap-4 h-full">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						Editor
						{isDirty && (
							<span className="text-xs text-amber-500 font-normal italic">(Unsaved changes)</span>
						)}
					</h2>
					<Button onClick={handleSave} disabled={!isDirty || isSaving} size="sm">
						{isSaving ? (
							<Loader2 className="h-4 w-4 animate-spin mr-2" />
						) : (
							<Save className="h-4 w-4 mr-2" />
						)}
						Save
					</Button>
				</div>

				<div className="space-y-1">
					<Label htmlFor={subjectId}>Subject Line (Supports Spintax)</Label>
					<Input
						id={subjectId}
						value={subject}
						onChange={(e) => {
							setSubject(e.target.value);
							setIsDirty(true);
						}}
						placeholder="{Hi|Hello} {{FirstName}}!"
						className="font-mono"
					/>
				</div>

				<div className="space-y-1 flex-1 flex flex-col">
					<div className="flex justify-between items-center mb-1">
						<Label htmlFor={bodyId}>Email Body (HTML/Text)</Label>
						<div className="flex gap-1">
							{AVAILABLE_VARIABLES.map((v) => (
								<Badge
									key={v}
									variant="outline"
									className="cursor-pointer hover:bg-accent text-[10px]"
									onClick={() => insertVariable(v)}
									title="Click to append"
								>
									{v}
								</Badge>
							))}
						</div>
					</div>
					<Textarea
						id={bodyId}
						value={body}
						onChange={(e) => {
							setBody(e.target.value);
							setIsDirty(true);
						}}
						className="flex-1 font-mono resize-none"
						placeholder="Write your email content here..."
					/>
					<p className="text-xs text-muted-foreground mt-1">
						Supports standard Spintax <code>{`{opt1|opt2}`}</code> and Variables{" "}
						<code>{`{{Variable}}`}</code>.
					</p>
				</div>
			</div>

			{/* Preview Column */}
			<div className="h-full">
				<LivePreview
					subjectTemplate={subject}
					bodyTemplate={body}
					lead={lead || null}
					isLoadingLead={isLoadingLead}
				/>
			</div>
		</div>
	);
}

function TemplateEditorSkeleton() {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div className="space-y-4">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-[400px] w-full" />
			</div>
			<div className="space-y-4">
				<Skeleton className="h-[500px] w-full" />
			</div>
		</div>
	);
}
