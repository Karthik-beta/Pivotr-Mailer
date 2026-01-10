// =============================================================================
// INTERNAL DESIGN TOKENS (not exposed to users)
// =============================================================================

export type ColorTheme =
    | "zinc"
    | "slate"
    | "stone"
    | "gray"
    | "neutral"
    | "red"
    | "rose"
    | "orange"
    | "green"
    | "blue"
    | "yellow"
    | "violet"

export type RadiusValue = "0" | "0.3" | "0.5" | "0.75" | "1.0"

export type FontFamily = "inter" | "noto-sans" | "nunito-sans" | "figtree" | "geist"

export type ThemeMode = "light" | "dark" | "system"

// =============================================================================
// USER-FACING ABSTRACTIONS
// =============================================================================

/**
 * Style presets are curated combinations of color, radius, and typography
 * that form a cohesive visual identity. Users choose a preset, not raw tokens.
 */
export type StylePreset =
    | "default"      // Balanced, professional, works for everything
    | "soft"         // Gentle, approachable, rounded
    | "sharp"        // Modern, precise, minimal radius
    | "bold"         // High contrast, vibrant accent colors
    | "calm"         // Muted tones, easy on the eyes

export interface StylePresetDefinition {
    id: StylePreset
    name: string
    description: string
    colorTheme: ColorTheme
    radius: RadiusValue
    fontFamily: FontFamily
}

export const STYLE_PRESETS: StylePresetDefinition[] = [
    {
        id: "default",
        name: "Default",
        description: "Clean and balanced. Works for any context.",
        colorTheme: "zinc",
        radius: "0.5",
        fontFamily: "inter",
    },
    {
        id: "soft",
        name: "Soft",
        description: "Rounded corners and gentle colors. Approachable and friendly.",
        colorTheme: "slate",
        radius: "1.0",
        fontFamily: "nunito-sans",
    },
    {
        id: "sharp",
        name: "Sharp",
        description: "Minimal radius, modern feel. Precise and professional.",
        colorTheme: "neutral",
        radius: "0.3",
        fontFamily: "geist",
    },
    {
        id: "bold",
        name: "Bold",
        description: "Vibrant accents with strong visual presence.",
        colorTheme: "blue",
        radius: "0.5",
        fontFamily: "figtree",
    },
    {
        id: "calm",
        name: "Calm",
        description: "Muted, earthy tones. Easy on the eyes for extended use.",
        colorTheme: "stone",
        radius: "0.75",
        fontFamily: "noto-sans",
    },
]

// =============================================================================
// ADVANCED CUSTOMIZATION (power users only)
// =============================================================================

/**
 * Semantic labels for radius options
 * Users understand "Rounded" better than "1.0"
 */
export const RADIUS_LABELS: Record<RadiusValue, { label: string; description: string }> = {
    "0": { label: "Square", description: "No rounding, sharp corners" },
    "0.3": { label: "Subtle", description: "Barely noticeable rounding" },
    "0.5": { label: "Balanced", description: "Default, works everywhere" },
    "0.75": { label: "Soft", description: "Noticeably rounded" },
    "1.0": { label: "Rounded", description: "Maximum rounding" },
}

/**
 * Semantic labels for color themes grouped by character
 */
export const COLOR_GROUPS = {
    neutral: {
        label: "Neutral",
        description: "Professional, understated",
        options: ["zinc", "slate", "stone", "gray", "neutral"] as ColorTheme[],
    },
    vibrant: {
        label: "Accent",
        description: "Distinctive brand colors",
        options: ["blue", "green", "violet", "orange", "rose", "red", "yellow"] as ColorTheme[],
    },
}

export const COLOR_META: Record<ColorTheme, { label: string; preview: string }> = {
    zinc: { label: "Zinc", preview: "#71717a" },
    slate: { label: "Slate", preview: "#64748b" },
    stone: { label: "Stone", preview: "#78716c" },
    gray: { label: "Gray", preview: "#6b7280" },
    neutral: { label: "Neutral", preview: "#737373" },
    red: { label: "Red", preview: "#ef4444" },
    rose: { label: "Rose", preview: "#f43f5e" },
    orange: { label: "Orange", preview: "#f97316" },
    green: { label: "Green", preview: "#22c55e" },
    blue: { label: "Blue", preview: "#3b82f6" },
    yellow: { label: "Yellow", preview: "#eab308" },
    violet: { label: "Violet", preview: "#8b5cf6" },
}

export const FONT_META: Record<FontFamily, { label: string; googleFont: string; character: string }> = {
    inter: {
        label: "Inter",
        googleFont: "Inter:wght@400;500;600;700",
        character: "Clean, highly readable. Great for data-heavy interfaces.",
    },
    "noto-sans": {
        label: "Noto Sans",
        googleFont: "Noto+Sans:wght@400;500;600;700",
        character: "Neutral and global. Excellent language support.",
    },
    "nunito-sans": {
        label: "Nunito Sans",
        googleFont: "Nunito+Sans:wght@400;500;600;700",
        character: "Friendly and approachable. Softer letterforms.",
    },
    figtree: {
        label: "Figtree",
        googleFont: "Figtree:wght@400;500;600;700",
        character: "Contemporary and geometric. Modern feel.",
    },
    geist: {
        label: "Geist",
        googleFont: "Geist:wght@400;500;600;700",
        character: "Technical and precise. Developer-focused.",
    },
}

// =============================================================================
// THEME CONFIGURATION STATE
// =============================================================================

export interface ThemeConfig {
    /** User's light/dark preference */
    mode: ThemeMode
    /** Selected style preset (null if using custom) */
    preset: StylePreset | null
    /** Custom overrides (only used when preset is null) */
    custom: {
        colorTheme: ColorTheme
        radius: RadiusValue
        fontFamily: FontFamily
    }
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
    mode: "system",
    preset: "default",
    custom: {
        colorTheme: "zinc",
        radius: "0.5",
        fontFamily: "inter",
    },
}

/**
 * Resolves the active visual tokens from config
 * If using a preset, returns preset values; otherwise returns custom values
 */
export function resolveThemeTokens(config: ThemeConfig): {
    colorTheme: ColorTheme
    radius: RadiusValue
    fontFamily: FontFamily
} {
    if (config.preset) {
        const preset = STYLE_PRESETS.find((p) => p.id === config.preset)
        if (preset) {
            return {
                colorTheme: preset.colorTheme,
                radius: preset.radius,
                fontFamily: preset.fontFamily,
            }
        }
    }
    return config.custom
}

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility during migration)
// =============================================================================

export const COLOR_THEME_OPTIONS = Object.entries(COLOR_META).map(([value, meta]) => ({
    value: value as ColorTheme,
    label: meta.label,
    color: meta.preview,
}))

export const RADIUS_OPTIONS = Object.entries(RADIUS_LABELS).map(([value, meta]) => ({
    value: value as RadiusValue,
    label: meta.label,
}))

export const FONT_OPTIONS = Object.entries(FONT_META).map(([value, meta]) => ({
    value: value as FontFamily,
    label: meta.label,
    googleFont: meta.googleFont,
}))
