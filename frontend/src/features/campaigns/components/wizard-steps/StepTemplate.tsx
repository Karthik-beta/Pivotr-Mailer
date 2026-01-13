/**
 * StepTemplate Component
 *
 * Step 2 of the campaign wizard - Email template configuration.
 * Features a two-column layout with editor and live preview.
 * Includes sign-off section with image/GIF support and markdown formatting.
 * Uses TanStack Form for declarative field binding with array support.
 */

import { sanitizeHtml } from "@/lib/sanitize";
import {
	Bold,
	ChevronDown,
	ChevronUp,
	Code,
	Globe,
	Heading1,
	Heading2,
	Image,
	Info,
	Italic,
	Linkedin,
	Link as LinkIcon,
	List,
	Mail,
	Phone,
	Plus,
	Quote,
	Shuffle,
	Trash2,
	Twitter,
} from "lucide-react";
import { marked } from "marked";
import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StepProps } from "../../types/formTypes";

// Platform icons
const PLATFORM_ICONS = {
	linkedin: Linkedin,
	twitter: Twitter,
	website: Globe,
	email: Mail,
	phone: Phone,
};

// Sample data for preview
const SAMPLE_LEAD = {
	firstName: "John",
	fullName: "John Smith",
	company: "Acme Corp",
	email: "john.smith@acme.com",
};

/**
 * Resolve Spintax syntax like {Hello|Hi|Hey} to a random option
 */
function resolveSpintax(text: string, randomize: boolean = true): string {
	return text.replace(/\{([^{}]+)\}/g, (_, options) => {
		const choices = options.split("|");
		if (randomize) {
			return choices[Math.floor(Math.random() * choices.length)];
		}
		return choices[0];
	});
}

/**
 * Replace template variables like {{FirstName}} with sample values
 */
function replaceVariables(text: string): string {
	return text
		.replace(/\{\{FirstName\}\}/gi, SAMPLE_LEAD.firstName)
		.replace(/\{\{FullName\}\}/gi, SAMPLE_LEAD.fullName)
		.replace(/\{\{Company\}\}/gi, SAMPLE_LEAD.company)
		.replace(/\{\{Email\}\}/gi, SAMPLE_LEAD.email);
}

/**
 * Parse markdown to HTML with full syntax support and sanitization
 */
function parseMarkdown(text: string): string {
	if (!text) return "";

	// Configure marked for full markdown support
	marked.setOptions({
		breaks: true, // Convert \n to <br>
		gfm: true, // GitHub Flavored Markdown
	});

	const html = marked.parse(text, { async: false }) as string;
	return sanitizeHtml(html);
}

export function StepTemplate({ form }: StepProps) {
	const [refreshKey, setRefreshKey] = useState(0);
	const [signOffExpanded, setSignOffExpanded] = useState(false);

	// Subscribe to form values for preview
	const templateValues = useStore(form.store, (state) => state.values.template);

	// Resolved preview content
	const resolvedSubject = useMemo(() => {
		return replaceVariables(resolveSpintax(templateValues.subject, refreshKey > 0));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templateValues.subject, refreshKey]);

	const resolvedBody = useMemo(() => {
		const resolved = replaceVariables(resolveSpintax(templateValues.body, refreshKey > 0));
		return parseMarkdown(resolved);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templateValues.body, refreshKey]);

	const resolvedSignOff = useMemo(() => {
		if (!templateValues.signOff?.enabled || !templateValues.signOff?.content) return "";
		const resolved = replaceVariables(
			resolveSpintax(templateValues.signOff.content, refreshKey > 0)
		);
		return parseMarkdown(resolved);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templateValues.signOff?.content, templateValues.signOff?.enabled, refreshKey]);

	const handleRandomize = () => {
		setRefreshKey((k) => k + 1);
	};

	// Text formatting helpers for body
	const insertBodyFormatting = (prefix: string, suffix: string = prefix) => {
		const textarea = document.getElementById("template.body") as HTMLTextAreaElement;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selectedText = text.substring(start, end);
		const newText = `${text.substring(0, start)}${prefix}${selectedText}${suffix}${text.substring(end)}`;

		form.setFieldValue("template.body", newText);

		// Restore focus after state update
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, end + prefix.length);
		}, 0);
	};

	// Text formatting helpers for sign-off
	const insertSignOffFormatting = (prefix: string, suffix: string = prefix) => {
		const textarea = document.getElementById("template.signOff.content") as HTMLTextAreaElement;
		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const text = textarea.value;
		const selectedText = text.substring(start, end);
		const newText = `${text.substring(0, start)}${prefix}${selectedText}${suffix}${text.substring(end)}`;

		form.setFieldValue("template.signOff.content", newText);

		// Restore focus after state update
		setTimeout(() => {
			textarea.focus();
			textarea.setSelectionRange(start + prefix.length, end + prefix.length);
		}, 0);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{/* Editor Column */}
			<div className="space-y-4">
				{/* Sender Info */}
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<form.Field name="template.senderName">
							{(field) => (
								<>
									<Label
										htmlFor={field.name}
										className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
									>
										Sender Name *
									</Label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="John Doe"
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
									)}
								</>
							)}
						</form.Field>
					</div>
					<div className="space-y-2">
						<form.Field name="template.senderEmail">
							{(field) => (
								<>
									<Label
										htmlFor={field.name}
										className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
									>
										Sender Email *
									</Label>
									<Input
										id={field.name}
										type="email"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										placeholder="john@company.com"
									/>
									{field.state.meta.errors.length > 0 && (
										<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
									)}
								</>
							)}
						</form.Field>
					</div>
				</div>

				{/* Subject with Spintax hint */}
				<div className="space-y-2">
					<div className="flex justify-between items-center">
						<form.Field name="template.subject">
							{(field) => (
								<>
									<Label
										htmlFor={field.name}
										className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
									>
										Subject *
									</Label>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 px-2">
													<Info className="h-3 w-3 mr-1" />
													<span className="text-xs">Spintax Guide</span>
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">
												<p className="font-medium mb-1">Spintax Syntax</p>
												<p className="text-xs">Use {"{Hi|Hello|Hey}"} to randomly select one option.</p>
												<p className="text-xs mt-1">Use {"{{FirstName}}"} for lead variables.</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</>
							)}
						</form.Field>
					</div>
					<form.Field name="template.subject">
						{(field) => (
							<>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="{Hi|Hello} {{FirstName}}, quick question about {{Company}}"
									className="font-mono text-sm"
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
								)}
							</>
						)}
					</form.Field>
				</div>

				{/* Body */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label
							htmlFor="template.body"
							className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
						>
							Email Body *
						</Label>
						<div className="flex gap-1 flex-wrap">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("# ", "")}
										>
											<Heading1 className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Heading 1</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("## ", "")}
										>
											<Heading2 className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Heading 2</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("**")}
										>
											<Bold className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Bold</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("*")}
										>
											<Italic className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Italic</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("[", "](url)")}
										>
											<LinkIcon className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Link</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("\n- ", "")}
										>
											<List className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>List</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("`")}
										>
											<Code className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Code</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 w-7 p-0"
											onClick={() => insertBodyFormatting("\n> ", "")}
										>
											<Quote className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Quote</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
					<form.Field name="template.body">
						{(field) => (
							<>
								<Textarea
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder={`# Welcome {{FirstName}}!

I hope this email finds you well. I wanted to reach out regarding **{{Company}}**.

## Key Points

- First important point
- Second important point
- Third important point

> This is a quote or callout text

Looking forward to hearing from you.

Best regards,`}
									className="font-mono text-sm min-h-[200px]"
									rows={10}
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
								)}
								<p className="text-xs text-muted-foreground">
									Supports Markdown and Spintax. Variables: {"{{FirstName}}"}, {"{{FullName}}"},
									{"{{Company}}"}, {"{{Email}}"}
								</p>
							</>
						)}
					</form.Field>
				</div>

				{/* CC Email */}
				<div className="space-y-2">
					<form.Field name="template.ccEmail">
						{(field) => (
							<>
								<Label
									htmlFor={field.name}
									className="font-mono text-xs uppercase tracking-wide text-muted-foreground"
								>
									CC Email (Optional)
								</Label>
								<Input
									id={field.name}
									type="email"
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									placeholder="team@company.com"
								/>
							</>
						)}
					</form.Field>
				</div>

				{/* Sign-off Section */}
				<Collapsible open={signOffExpanded} onOpenChange={setSignOffExpanded}>
					<Card className="border-dashed">
						<CardHeader className="pb-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<form.Field name="template.signOff.enabled">
										{(field) => (
											<>
												<Switch
													id={field.name}
													checked={field.state.value}
													onCheckedChange={(checked) => {
														field.handleChange(checked);
														if (checked) setSignOffExpanded(true);
													}}
												/>
												<Label htmlFor={field.name} className="font-medium cursor-pointer">
													Email Sign-off
												</Label>
												{field.state.value && (
													<Badge variant="secondary" className="text-xs">
														Enabled
													</Badge>
												)}
											</>
										)}
									</form.Field>
								</div>
								<CollapsibleTrigger asChild>
									<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
										{signOffExpanded ? (
											<ChevronUp className="h-4 w-4" />
										) : (
											<ChevronDown className="h-4 w-4" />
										)}
									</Button>
								</CollapsibleTrigger>
							</div>
						</CardHeader>
						<CollapsibleContent>
							<CardContent className="space-y-4 pt-2">
								{/* Sign-off Content with Markdown */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
											Sign-off Content (Markdown)
										</Label>
										<div className="flex gap-1 flex-wrap">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("# ", "")}
															disabled={!templateValues.signOff?.enabled}
														>
															<Heading1 className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Heading 1</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("## ", "")}
															disabled={!templateValues.signOff?.enabled}
														>
															<Heading2 className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Heading 2</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("**")}
															disabled={!templateValues.signOff?.enabled}
														>
															<Bold className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Bold</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("*")}
															disabled={!templateValues.signOff?.enabled}
														>
															<Italic className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Italic</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("[", "](url)")}
															disabled={!templateValues.signOff?.enabled}
														>
															<LinkIcon className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>Link</TooltipContent>
												</Tooltip>
											</TooltipProvider>
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="h-7 w-7 p-0"
															onClick={() => insertSignOffFormatting("\n- ", "")}
															disabled={!templateValues.signOff?.enabled}
														>
															<List className="h-3 w-3" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>List</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									</div>
									<form.Field name="template.signOff.content">
										{(field) => (
											<>
												<Textarea
													id={field.name}
													value={field.state.value}
													onChange={(e) => field.handleChange(e.target.value)}
													onBlur={field.handleBlur}
													placeholder={`**Best regards,**

*John Smith*
Senior Sales Executive | Acme Corp

![Company Logo](https://example.com/logo.png)

---
📧 john@acme.com | 📱 +1 234 567 8900
🌐 [www.acme.com](https://acme.com)`}
													className="font-mono text-sm min-h-[150px]"
													rows={7}
													disabled={!templateValues.signOff?.enabled}
												/>
												<p className="text-xs text-muted-foreground">
													Full Markdown support: # Heading, **bold**, *italic*, [links](url),
													![images](url), lists, quotes, and more.
												</p>
											</>
										)}
									</form.Field>
								</div>

								{/* Media (Images/GIFs) - Using array mode */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
											Images / GIFs / Logo
										</Label>
										<form.Field name="template.signOff.media" mode="array">
											{(mediaField) => (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														mediaField.pushValue({ type: "image", url: "", alt: "" })
													}
													disabled={!templateValues.signOff?.enabled}
												>
													<Plus className="h-3 w-3 mr-1" />
													Add Media
												</Button>
											)}
										</form.Field>
									</div>
									<form.Field name="template.signOff.media" mode="array">
										{(mediaField) => (
											<>
												{mediaField.state.value?.map((media, index) => (
													<div key={index} className="flex gap-2 items-start p-3 rounded-lg bg-muted/50">
														<form.Field name={`template.signOff.media[${index}].type`}>
															{(field) => (
																<Select
																	value={field.state.value}
																	onValueChange={(value: "image" | "gif" | "logo") =>
																		field.handleChange(value)
																	}
																	disabled={!templateValues.signOff?.enabled}
																>
																	<SelectTrigger className="w-24">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="image">Image</SelectItem>
																		<SelectItem value="gif">GIF</SelectItem>
																		<SelectItem value="logo">Logo</SelectItem>
																	</SelectContent>
																</Select>
															)}
														</form.Field>
														<div className="flex-1 space-y-2">
															<form.Field name={`template.signOff.media[${index}].url`}>
																{(field) => (
																	<Input
																		value={field.state.value}
																		onChange={(e) => field.handleChange(e.target.value)}
																		placeholder="https://example.com/image.png"
																		className="font-mono text-xs"
																		disabled={!templateValues.signOff?.enabled}
																	/>
																)}
															</form.Field>
															<div className="grid grid-cols-3 gap-2">
																<form.Field name={`template.signOff.media[${index}].alt`}>
																	{(field) => (
																		<Input
																			value={field.state.value ?? ""}
																			onChange={(e) => field.handleChange(e.target.value)}
																			placeholder="Alt text"
																			className="text-xs"
																			disabled={!templateValues.signOff?.enabled}
																		/>
																	)}
																</form.Field>
																<form.Field name={`template.signOff.media[${index}].width`}>
																	{(field) => (
																		<Input
																			type="number"
																			value={field.state.value ?? ""}
																			onChange={(e) =>
																				field.handleChange(
																					parseInt(e.target.value, 10) || undefined
																				)
																			}
																			placeholder="Width"
																			className="text-xs"
																			disabled={!templateValues.signOff?.enabled}
																		/>
																	)}
																</form.Field>
																<form.Field name={`template.signOff.media[${index}].link`}>
																	{(field) => (
																		<Input
																			value={field.state.value ?? ""}
																			onChange={(e) => field.handleChange(e.target.value)}
																			placeholder="Link URL"
																			className="text-xs"
																			disabled={!templateValues.signOff?.enabled}
																		/>
																	)}
																</form.Field>
															</div>
														</div>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => mediaField.removeValue(index)}
															className="h-8 w-8 p-0 text-destructive"
															disabled={!templateValues.signOff?.enabled}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												))}
											</>
										)}
									</form.Field>
								</div>

								{/* Social Links - Using array mode */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
											Social Links
										</Label>
										<form.Field name="template.signOff.socialLinks" mode="array">
											{(linksField) => (
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														linksField.pushValue({ platform: "linkedin", url: "" })
													}
													disabled={!templateValues.signOff?.enabled}
												>
													<Plus className="h-3 w-3 mr-1" />
													Add Link
												</Button>
											)}
										</form.Field>
									</div>
									<form.Field name="template.signOff.socialLinks" mode="array">
										{(linksField) => (
											<>
												{linksField.state.value?.map((link, index) => {
													const Icon = PLATFORM_ICONS[link.platform];
													return (
														<div key={index} className="flex gap-2 items-center">
															<form.Field name={`template.signOff.socialLinks[${index}].platform`}>
																{(field) => (
																	<Select
																		value={field.state.value}
																		onValueChange={(
																			value: "linkedin" | "twitter" | "website" | "email" | "phone"
																		) => field.handleChange(value)}
																		disabled={!templateValues.signOff?.enabled}
																	>
																		<SelectTrigger className="w-32">
																			<div className="flex items-center gap-2">
																				<Icon className="h-3 w-3" />
																				<SelectValue />
																			</div>
																		</SelectTrigger>
																		<SelectContent>
																			<SelectItem value="linkedin">LinkedIn</SelectItem>
																			<SelectItem value="twitter">Twitter</SelectItem>
																			<SelectItem value="website">Website</SelectItem>
																			<SelectItem value="email">Email</SelectItem>
																			<SelectItem value="phone">Phone</SelectItem>
																		</SelectContent>
																	</Select>
																)}
															</form.Field>
															<form.Field name={`template.signOff.socialLinks[${index}].url`}>
																{(field) => (
																	<Input
																		value={field.state.value}
																		onChange={(e) => field.handleChange(e.target.value)}
																		placeholder={
																			link.platform === "email"
																				? "email@example.com"
																				: link.platform === "phone"
																					? "+1 234 567 8900"
																					: "https://..."
																		}
																		className="flex-1 font-mono text-xs"
																		disabled={!templateValues.signOff?.enabled}
																	/>
																)}
															</form.Field>
															<form.Field name={`template.signOff.socialLinks[${index}].label`}>
																{(field) => (
																	<Input
																		value={field.state.value ?? ""}
																		onChange={(e) => field.handleChange(e.target.value)}
																		placeholder="Label (optional)"
																		className="w-32 text-xs"
																		disabled={!templateValues.signOff?.enabled}
																	/>
																)}
															</form.Field>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => linksField.removeValue(index)}
																className="h-8 w-8 p-0 text-destructive"
																disabled={!templateValues.signOff?.enabled}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													);
												})}
											</>
										)}
									</form.Field>
								</div>
							</CardContent>
						</CollapsibleContent>
					</Card>
				</Collapsible>
			</div>

			{/* Preview Column */}
			<div className="space-y-4">
				<div className="flex justify-between items-center">
					<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
						Live Preview
					</Label>
					<Button variant="outline" size="sm" onClick={handleRandomize}>
						<Shuffle className="h-3 w-3 mr-1" />
						Randomize
					</Button>
				</div>
				<Card className="bg-muted/50">
					<CardHeader className="pb-2 border-b space-y-1">
						<div className="font-mono text-xs text-muted-foreground">
							From: {templateValues.senderName || "Sender"} &lt;
							{templateValues.senderEmail || "email@example.com"}&gt;
						</div>
						<div className="font-mono text-xs text-muted-foreground">To: {SAMPLE_LEAD.email}</div>
						{templateValues.ccEmail && (
							<div className="font-mono text-xs text-muted-foreground">
								CC: {templateValues.ccEmail}
							</div>
						)}
						<div className="font-semibold pt-2">{resolvedSubject || "Subject preview..."}</div>
					</CardHeader>
					<CardContent className="pt-4 space-y-4">
						{/* Email Body */}
						{templateValues.body ? (
							<div
								className="prose prose-sm max-w-none dark:prose-invert"
								dangerouslySetInnerHTML={{ __html: resolvedBody }}
							/>
						) : (
							<p className="text-muted-foreground italic">Email body preview will appear here...</p>
						)}

						{/* Sign-off Preview */}
						{templateValues.signOff?.enabled && (
							<div className="border-t pt-4 space-y-3">
								{/* Markdown Content */}
								{resolvedSignOff && (
									<div
										className="prose prose-sm max-w-none dark:prose-invert"
										dangerouslySetInnerHTML={{ __html: resolvedSignOff }}
									/>
								)}

								{/* Media Preview */}
								{templateValues.signOff.media && templateValues.signOff.media.length > 0 && (
									<div className="flex flex-wrap gap-3">
										{templateValues.signOff.media.map((media, index) => (
											<div key={index} className="relative">
												{media.url ? (
													media.link ? (
														<a href={media.link} target="_blank" rel="noopener noreferrer">
															<img
																src={media.url}
																alt={media.alt || `${media.type} ${index + 1}`}
																style={{
																	width: media.width ? `${media.width}px` : "auto",
																	maxWidth: "200px",
																}}
																className="rounded border"
															/>
														</a>
													) : (
														<img
															src={media.url}
															alt={media.alt || `${media.type} ${index + 1}`}
															style={{
																width: media.width ? `${media.width}px` : "auto",
																maxWidth: "200px",
															}}
															className="rounded border"
														/>
													)
												) : (
													<div className="w-24 h-24 bg-muted rounded border flex items-center justify-center">
														<Image className="h-8 w-8 text-muted-foreground" />
													</div>
												)}
												<Badge
													variant="secondary"
													className="absolute -top-2 -right-2 text-[10px] px-1"
												>
													{media.type}
												</Badge>
											</div>
										))}
									</div>
								)}

								{/* Social Links Preview */}
								{templateValues.signOff.socialLinks &&
									templateValues.signOff.socialLinks.length > 0 && (
										<div className="flex flex-wrap gap-2 pt-2">
											{templateValues.signOff.socialLinks.map((link, index) => {
												const Icon = PLATFORM_ICONS[link.platform];
												return (
													<a
														key={index}
														href={
															link.platform === "email"
																? `mailto:${link.url}`
																: link.platform === "phone"
																	? `tel:${link.url}`
																	: link.url
														}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
													>
														<Icon className="h-3 w-3" />
														{link.label || link.platform}
													</a>
												);
											})}
										</div>
									)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
