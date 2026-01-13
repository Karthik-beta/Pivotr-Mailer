/**
 * StepDelay Component
 *
 * Step 4 of the campaign wizard - Delay configuration with visual Gaussian curve.
 */

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { CampaignFormData } from "../CampaignWizard";

interface StepDelayProps {
	data: CampaignFormData;
	onChange: (data: Partial<CampaignFormData>) => void;
	errors: Record<string, string>;
}

/**
 * Format milliseconds to human-readable string
 */
function formatDelay(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (remainingSeconds === 0) {
		return `${minutes}m`;
	}
	return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Generate Gaussian distribution bars for visualization
 */
function generateGaussianBars(minMs: number, maxMs: number, barCount: number = 20): number[] {
	const bars: number[] = [];
	const mean = (minMs + maxMs) / 2;
	const stdDev = (maxMs - minMs) / 6; // 99.7% falls within 3 std devs

	for (let i = 0; i < barCount; i++) {
		const x = minMs + ((maxMs - minMs) * i) / (barCount - 1);
		// Gaussian PDF
		const exponent = -((x - mean) ** 2) / (2 * stdDev ** 2);
		const height = Math.exp(exponent) * 100;
		bars.push(Math.max(5, height)); // Min height of 5%
	}

	return bars;
}

export function StepDelay({ data, onChange, errors }: StepDelayProps) {
	const updateDelayConfig = (
		field: keyof CampaignFormData["delayConfig"],
		value: number | boolean
	) => {
		onChange({
			delayConfig: {
				...data.delayConfig,
				[field]: value,
			},
		});
	};

	const gaussianBars = useMemo(
		() => generateGaussianBars(data.delayConfig.minDelayMs, data.delayConfig.maxDelayMs),
		[data.delayConfig.minDelayMs, data.delayConfig.maxDelayMs]
	);

	// Convert ms to seconds for slider
	const minSeconds = data.delayConfig.minDelayMs / 1000;
	const maxSeconds = data.delayConfig.maxDelayMs / 1000;

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				Configure the delay between sending emails. A Gaussian distribution ensures human-like,
				natural timing patterns that help with email deliverability.
			</p>

			{/* Delay Sliders */}
			<Card className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
				<div className="space-y-6">
					{/* Min Delay */}
					<div className="space-y-4">
						<div className="flex justify-between">
							<Label className="font-mono text-sm">Min Delay</Label>
							<span className="font-mono text-sm font-bold">
								{formatDelay(data.delayConfig.minDelayMs)}
							</span>
						</div>
						<Slider
							value={[minSeconds]}
							onValueChange={([v]) => updateDelayConfig("minDelayMs", v * 1000)}
							min={5}
							max={300}
							step={5}
						/>
						<p className="text-xs text-muted-foreground">
							Minimum time between consecutive emails (5s - 5min)
						</p>
					</div>

					{/* Max Delay */}
					<div className="space-y-4">
						<div className="flex justify-between">
							<Label className="font-mono text-sm">Max Delay</Label>
							<span className="font-mono text-sm font-bold">
								{formatDelay(data.delayConfig.maxDelayMs)}
							</span>
						</div>
						<Slider
							value={[maxSeconds]}
							onValueChange={([v]) => {
								// Ensure max is always >= min
								const newMax = Math.max(v * 1000, data.delayConfig.minDelayMs);
								updateDelayConfig("maxDelayMs", newMax);
							}}
							min={10}
							max={600}
							step={5}
						/>
						<p className="text-xs text-muted-foreground">
							Maximum time between consecutive emails (10s - 10min)
						</p>
					</div>
				</div>
			</Card>

			{/* Gaussian Distribution Visualization */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
						Delay Distribution (Gaussian)
					</Label>
					<div className="flex items-center gap-2">
						<Label htmlFor="gaussianEnabled" className="text-sm">
							Enabled
						</Label>
						<Switch
							id="gaussianEnabled"
							checked={data.delayConfig.gaussianEnabled}
							onCheckedChange={(checked) => updateDelayConfig("gaussianEnabled", checked)}
						/>
					</div>
				</div>
				<div className="h-32 bg-muted rounded-lg flex items-end justify-center gap-1 p-4">
					{gaussianBars.map((height, i) => (
						<div
							key={i}
							className="w-2 bg-primary rounded-t transition-all duration-300"
							style={{ height: `${height}%` }}
						/>
					))}
				</div>
				<div className="flex justify-between text-xs text-muted-foreground font-mono">
					<span>{formatDelay(data.delayConfig.minDelayMs)}</span>
					<span className="text-center">
						Avg: {formatDelay((data.delayConfig.minDelayMs + data.delayConfig.maxDelayMs) / 2)}
					</span>
					<span>{formatDelay(data.delayConfig.maxDelayMs)}</span>
				</div>
				<p className="text-xs text-muted-foreground text-center">
					{data.delayConfig.gaussianEnabled
						? "Most emails will be sent with delays near the center of this range"
						: "Delays will be uniformly random between min and max"}
				</p>
			</div>

			{/* Validation errors */}
			{errors["delayConfig.minDelayMs"] && (
				<p className="text-sm text-destructive">{errors["delayConfig.minDelayMs"]}</p>
			)}
			{errors["delayConfig.maxDelayMs"] && (
				<p className="text-sm text-destructive">{errors["delayConfig.maxDelayMs"]}</p>
			)}
		</div>
	);
}
