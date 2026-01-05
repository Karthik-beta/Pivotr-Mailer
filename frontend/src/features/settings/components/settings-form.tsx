import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { type Resolver, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "../hooks/use-settings";

const settingsSchema = z.object({
	awsSesRegion: z.string().min(1, "Required"),
	awsSesAccessKeyId: z.string().optional(),
	awsSesSecretAccessKey: z.string().optional(),
	awsSqsQueueUrl: z.string().optional(),
	awsSqsRegion: z.string().min(1, "Required"),
	myEmailVerifierApiKey: z.string().optional(),
	defaultMinDelayMs: z.coerce.number().min(0),
	defaultMaxDelayMs: z.coerce.number().min(0),
	sqsPollingIntervalMs: z.coerce.number().min(100),
	maxRetries: z.coerce.number().min(0),
	unsubscribeTokenSecret: z.string().min(10, "Must be at least 10 chars"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function SettingsForm() {
	const { settings, updateSettings, isSaving } = useSettings();

	const form = useForm<SettingsFormValues>({
		resolver: zodResolver(settingsSchema) as Resolver<SettingsFormValues>,
		defaultValues: {
			awsSesRegion: settings?.awsSesRegion || "ap-south-1",
			awsSesAccessKeyId: settings?.awsSesAccessKeyId || "",
			awsSesSecretAccessKey: settings?.awsSesSecretAccessKey || "",
			awsSqsQueueUrl: settings?.awsSqsQueueUrl || "",
			awsSqsRegion: settings?.awsSqsRegion || "ap-south-1",
			myEmailVerifierApiKey: settings?.myEmailVerifierApiKey || "",
			defaultMinDelayMs: (settings?.defaultMinDelayMs as number) || 60000,
			defaultMaxDelayMs: (settings?.defaultMaxDelayMs as number) || 180000,
			sqsPollingIntervalMs: (settings?.sqsPollingIntervalMs as number) || 60000,
			maxRetries: (settings?.maxRetries as number) || 3,
			unsubscribeTokenSecret: settings?.unsubscribeTokenSecret || "",
		} as SettingsFormValues,
	});

	function onSubmit(data: SettingsFormValues) {
		updateSettings(data);
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* AWS Configuration */}
				<Card>
					<CardHeader>
						<CardTitle>AWS SES & SQS</CardTitle>
						<CardDescription>Configure connection to AWS services.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="awsSesRegion"
								render={({ field }) => (
									<FormItem>
										<FormLabel>SES Region</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="awsSqsRegion"
								render={({ field }) => (
									<FormItem>
										<FormLabel>SQS Region</FormLabel>
										<FormControl>
											<Input {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="awsSesAccessKeyId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Access Key ID</FormLabel>
										<FormControl>
											<Input {...field} type="password" />
										</FormControl>
										<FormDescription>
											Currently provided: {settings?.awsSesAccessKeyId ? "Yes" : "No"}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="awsSesSecretAccessKey"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Secret Access Key</FormLabel>
										<FormControl>
											<Input {...field} type="password" />
										</FormControl>
										<FormDescription>
											Currently provided: {settings?.awsSesSecretAccessKey ? "Yes" : "No"}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="awsSqsQueueUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>SQS Queue URL</FormLabel>
									<FormControl>
										<Input {...field} placeholder="https://sqs..." />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* Third Party Services */}
				<Card>
					<CardHeader>
						<CardTitle>Services</CardTitle>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name="myEmailVerifierApiKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>MyEmailVerifier API Key</FormLabel>
									<FormControl>
										<Input {...field} type="password" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				{/* System Limits */}
				<Card>
					<CardHeader>
						<CardTitle>System & Limits</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="defaultMinDelayMs"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Default Min Delay (ms)</FormLabel>
										<FormControl>
											<Input {...field} type="number" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="defaultMaxDelayMs"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Default Max Delay (ms)</FormLabel>
										<FormControl>
											<Input {...field} type="number" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="sqsPollingIntervalMs"
								render={({ field }) => (
									<FormItem>
										<FormLabel>SQS Polling Interval (ms)</FormLabel>
										<FormControl>
											<Input {...field} type="number" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="maxRetries"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Max Retries</FormLabel>
										<FormControl>
											<Input {...field} type="number" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="unsubscribeTokenSecret"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Unsubscribe Token Secret</FormLabel>
									<FormControl>
										<Input {...field} type="password" />
									</FormControl>
									<FormDescription>
										Critical for generating valid unsubscribe links.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>
				</Card>

				<div className="flex justify-end">
					<Button type="submit" disabled={isSaving} className="w-full md:w-auto">
						{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isSaving ? "Saving..." : "Save Configuration"}
					</Button>
				</div>
			</form>
		</Form>
	);
}

export function SettingsSkeleton() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-[300px] w-full" />
			<Skeleton className="h-[200px] w-full" />
			<Skeleton className="h-[300px] w-full" />
		</div>
	);
}
