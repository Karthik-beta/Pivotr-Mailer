import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

import {
	selectPreset,
	setCustomColorTheme,
	setCustomFontFamily,
	setCustomRadius,
	setThemeMode,
	useResolvedTokens,
	useStylePreset,
	useThemeConfig,
} from "@/lib/theme";
import type { FontFamily, RadiusValue, ThemeMode } from "@/lib/theme/types";
import {
	COLOR_GROUPS,
	COLOR_META,
	FONT_META,
	RADIUS_LABELS,
	STYLE_PRESETS,
} from "@/lib/theme/types";
import { cn } from "@/lib/utils";

// =============================================================================
// MODE SECTION
// =============================================================================

function ModeSection() {
	const config = useThemeConfig();

	const modes: { value: ThemeMode; label: string; icon: typeof Sun; hint: string }[] = [
		{ value: "light", label: "Light", icon: Sun, hint: "Always light" },
		{ value: "dark", label: "Dark", icon: Moon, hint: "Always dark" },
		{ value: "system", label: "System", icon: Monitor, hint: "Match device" },
	];

	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h3 className="text-sm font-semibold tracking-tight">Appearance</h3>
				<p className="text-[13px] leading-relaxed text-muted-foreground">
					Choose how the interface looks on your device
				</p>
			</div>

			<div className="grid grid-cols-3 gap-3">
				{modes.map((mode) => {
					const isActive = config.mode === mode.value;
					return (
						<button
							key={mode.value}
							type="button"
							onClick={() => setThemeMode(mode.value)}
							className={cn(
								"group flex flex-col items-center gap-2.5 rounded-xl border-2 px-3 py-4 transition-all",
								isActive
									? "border-primary bg-primary/5 shadow-sm"
									: "border-border/50 bg-card hover:border-border hover:bg-accent/50"
							)}
						>
							<mode.icon
								className={cn(
									"size-5 transition-colors",
									isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
								)}
							/>
							<div className="text-center">
								<div className="text-sm font-medium">{mode.label}</div>
							</div>
						</button>
					);
				})}
			</div>

			{config.mode === "system" && (
				<div className="rounded-lg bg-muted/60 px-3.5 py-3">
					<p className="text-[13px] leading-relaxed text-muted-foreground">
						Automatically switches between light and dark based on your device settings.
					</p>
				</div>
			)}
		</section>
	);
}

// =============================================================================
// STYLE PRESET SECTION
// =============================================================================

function StylePresetSection() {
	const currentPreset = useStylePreset();

	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h3 className="text-sm font-semibold tracking-tight">Style</h3>
				<p className="text-[13px] leading-relaxed text-muted-foreground">
					Choose a look that fits your preference
				</p>
			</div>

			<div className="space-y-2.5">
				{STYLE_PRESETS.map((preset) => {
					const isActive = currentPreset === preset.id;
					return (
						<button
							key={preset.id}
							type="button"
							onClick={() => selectPreset(preset.id)}
							className={cn(
								"group flex w-full items-start gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-all",
								isActive
									? "border-primary bg-primary/5 shadow-sm"
									: "border-border/50 bg-card hover:border-border hover:bg-accent/50"
							)}
						>
							{/* Visual preview of the style */}
							<div className="flex shrink-0 items-center gap-1 pt-0.5">
								<div
									className="size-4 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/10"
									style={{ backgroundColor: COLOR_META[preset.colorTheme].preview }}
								/>
								<div
									className="size-4 ring-1 ring-inset ring-black/10 dark:ring-white/10"
									style={{
										backgroundColor: COLOR_META[preset.colorTheme].preview,
										borderRadius: `${Number(preset.radius) * 5}px`,
									}}
								/>
							</div>

							<div className="flex-1 min-w-0 space-y-0.5">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">{preset.name}</span>
									{isActive && <Check className="size-4 text-primary" />}
								</div>
								<p className="text-[13px] leading-relaxed text-muted-foreground">
									{preset.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>
		</section>
	);
}

// =============================================================================
// ADVANCED SECTION
// =============================================================================

function AdvancedSection() {
	const [isOpen, setIsOpen] = useState(false);
	const tokens = useResolvedTokens();
	const preset = useStylePreset();

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center justify-between rounded-xl bg-muted/60 px-4 py-3 text-sm transition-colors hover:bg-muted"
				>
					<span className="font-medium text-muted-foreground">Advanced customization</span>
					<ChevronDown
						className={cn(
							"size-4 text-muted-foreground transition-transform duration-200",
							isOpen && "rotate-180"
						)}
					/>
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent className="space-y-6 pt-5">
				{preset !== null && (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
						<p className="text-[13px] leading-relaxed text-amber-700 dark:text-amber-400">
							Changing these options will override your current preset and switch to a custom style.
						</p>
					</div>
				)}

				{/* Color */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Accent Color
					</h4>
					<div className="space-y-4">
						{Object.entries(COLOR_GROUPS).map(([key, group]) => (
							<div key={key} className="space-y-2.5">
								<span className="text-[13px] text-muted-foreground">{group.label}</span>
								<div className="flex flex-wrap gap-2">
									{group.options.map((color) => {
										const isActive = tokens.colorTheme === color;
										return (
											<button
												key={color}
												type="button"
												onClick={() => setCustomColorTheme(color)}
												title={COLOR_META[color].label}
												className={cn(
													"size-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
													isActive
														? "ring-primary scale-110"
														: "ring-transparent hover:ring-muted-foreground/40 hover:scale-105"
												)}
												style={{ backgroundColor: COLOR_META[color].preview }}
											>
												{isActive && <Check className="size-4 text-white mx-auto drop-shadow-md" />}
											</button>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Radius */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Corner Rounding
					</h4>
					<div className="flex flex-wrap gap-2">
						{(
							Object.entries(RADIUS_LABELS) as [RadiusValue, (typeof RADIUS_LABELS)[RadiusValue]][]
						).map(([value, meta]) => {
							const isActive = tokens.radius === value;
							return (
								<button
									key={value}
									type="button"
									onClick={() => setCustomRadius(value)}
									title={meta.description}
									className={cn(
										"flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all",
										isActive
											? "border-primary bg-primary/5 text-primary"
											: "border-border/50 bg-card hover:border-border hover:bg-accent/50"
									)}
								>
									{meta.label}
								</button>
							);
						})}
					</div>
				</div>

				{/* Font */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Typography
					</h4>
					<div className="space-y-2">
						{(Object.entries(FONT_META) as [FontFamily, (typeof FONT_META)[FontFamily]][]).map(
							([value, meta]) => {
								const isActive = tokens.fontFamily === value;
								return (
									<button
										key={value}
										type="button"
										onClick={() => setCustomFontFamily(value)}
										className={cn(
											"flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all",
											isActive
												? "border-primary bg-primary/5"
												: "border-border/50 bg-card hover:border-border hover:bg-accent/50"
										)}
										style={{ fontFamily: `"${meta.label}", sans-serif` }}
									>
										<span className="text-xl font-semibold w-10 text-center">Aa</span>
										<div className="flex-1 min-w-0 space-y-0.5">
											<span className="text-sm font-medium">{meta.label}</span>
											<p className="text-[13px] leading-relaxed text-muted-foreground">
												{meta.character}
											</p>
										</div>
										{isActive && <Check className="size-4 text-primary shrink-0" />}
									</button>
								);
							}
						)}
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface AppearanceSheetProps {
	trigger?: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function AppearanceSheet({ trigger, open, onOpenChange }: AppearanceSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
			<SheetContent className="w-[360px] sm:w-[420px] overflow-y-auto">
				<SheetHeader className="space-y-1.5 px-6 pb-2">
					<SheetTitle className="text-lg">Appearance</SheetTitle>
					<SheetDescription className="text-[13px] leading-relaxed">
						Customize how the app looks and feels
					</SheetDescription>
				</SheetHeader>

				{/*
				 * Spacing hierarchy:
				 * - Section gap: 32px (space-y-8)
				 * - Intra-section elements: 16px (space-y-4)
				 * - Tight groupings: 10-12px (space-y-2.5 / space-y-3)
				 */}
				<div className="mt-8 space-y-8 px-6">
					<ModeSection />

					<div className="border-t border-border/60" />

					<StylePresetSection />

					<div className="border-t border-border/60" />

					<AdvancedSection />

					{/* Bottom padding for scroll comfort */}
					<div className="h-4" />
				</div>
			</SheetContent>
		</Sheet>
	);
}
