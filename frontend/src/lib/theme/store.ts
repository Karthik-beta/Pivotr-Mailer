import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import type {
	ColorTheme,
	FontFamily,
	RadiusValue,
	StylePreset,
	ThemeConfig,
	ThemeMode,
} from "./types";
import { DEFAULT_THEME_CONFIG, resolveThemeTokens } from "./types";

const STORAGE_KEY = "pivotr-theme-config";

/**
 * Load theme config from localStorage.
 * Only call this on the client after hydration.
 */
function loadThemeConfigFromStorage(): ThemeConfig {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Handle legacy format migration
			if ("colorTheme" in parsed && !("preset" in parsed)) {
				return {
					mode: parsed.mode || "system",
					preset: null,
					custom: {
						colorTheme: parsed.colorTheme || "zinc",
						radius: parsed.radius || "0.5",
						fontFamily: parsed.fontFamily || "inter",
					},
				};
			}
			return { ...DEFAULT_THEME_CONFIG, ...parsed };
		}
	} catch {
		// Ignore parse errors
	}
	return DEFAULT_THEME_CONFIG;
}

function saveThemeConfig(config: ThemeConfig): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// Ignore storage errors
	}
}

// Initialize with DEFAULT_THEME_CONFIG for SSR hydration consistency.
// Server and client must start with the same value to avoid hydration mismatch.
// localStorage values are loaded after hydration via hydrateThemeFromStorage().
export const themeStore = new Store<ThemeConfig>(DEFAULT_THEME_CONFIG);

// Subscribe to changes and persist
themeStore.subscribe(() => {
	saveThemeConfig(themeStore.state);
});

/**
 * Hydrate theme store from localStorage after client mount.
 * Call this once in a useEffect to avoid hydration mismatch.
 */
let isHydrated = false;
export function hydrateThemeFromStorage(): void {
	if (typeof window === "undefined" || isHydrated) return;
	isHydrated = true;

	const stored = loadThemeConfigFromStorage();
	// Only update if different from default to avoid unnecessary re-renders
	if (JSON.stringify(stored) !== JSON.stringify(DEFAULT_THEME_CONFIG)) {
		themeStore.setState(() => stored);
	}
}

// =============================================================================
// HOOKS - Read state reactively
// =============================================================================

export function useThemeConfig(): ThemeConfig {
	return useStore(themeStore);
}

export function useThemeMode(): ThemeMode {
	return useStore(themeStore, (state) => state.mode);
}

export function useStylePreset(): StylePreset | null {
	return useStore(themeStore, (state) => state.preset);
}

/**
 * Returns the resolved visual tokens (handles preset vs custom)
 */
export function useResolvedTokens(): {
	colorTheme: ColorTheme;
	radius: RadiusValue;
	fontFamily: FontFamily;
} {
	const config = useStore(themeStore);
	return resolveThemeTokens(config);
}

// Legacy hooks for backwards compatibility
export function useColorTheme(): ColorTheme {
	const config = useStore(themeStore);
	return resolveThemeTokens(config).colorTheme;
}

export function useRadius(): RadiusValue {
	const config = useStore(themeStore);
	return resolveThemeTokens(config).radius;
}

export function useFontFamily(): FontFamily {
	const config = useStore(themeStore);
	return resolveThemeTokens(config).fontFamily;
}

// =============================================================================
// ACTIONS - Mutate state
// =============================================================================

/**
 * Set the light/dark mode preference
 */
export function setThemeMode(mode: ThemeMode): void {
	themeStore.setState((prev) => ({ ...prev, mode }));
}

/**
 * Select a curated style preset
 * This is the primary way users should customize the theme
 */
export function selectPreset(preset: StylePreset): void {
	themeStore.setState((prev) => ({ ...prev, preset }));
}

/**
 * Switch to custom mode and set a specific color theme
 * Only for advanced users who want granular control
 */
export function setCustomColorTheme(colorTheme: ColorTheme): void {
	themeStore.setState((prev) => ({
		...prev,
		preset: null,
		custom: { ...prev.custom, colorTheme },
	}));
}

/**
 * Switch to custom mode and set a specific radius
 * Only for advanced users who want granular control
 */
export function setCustomRadius(radius: RadiusValue): void {
	themeStore.setState((prev) => ({
		...prev,
		preset: null,
		custom: { ...prev.custom, radius },
	}));
}

/**
 * Switch to custom mode and set a specific font
 * Only for advanced users who want granular control
 */
export function setCustomFontFamily(fontFamily: FontFamily): void {
	themeStore.setState((prev) => ({
		...prev,
		preset: null,
		custom: { ...prev.custom, fontFamily },
	}));
}

/**
 * Reset to default preset
 */
export function resetTheme(): void {
	themeStore.setState(() => DEFAULT_THEME_CONFIG);
}

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

export const setColorTheme = setCustomColorTheme;
export const setRadius = setCustomRadius;
export const setFontFamily = setCustomFontFamily;
