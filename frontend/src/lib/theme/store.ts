import { useStore } from "@tanstack/react-store";
import { Store } from "@tanstack/store";
import { setThemeCookie } from "@/lib/cookies";
import type {
	ColorTheme,
	FontFamily,
	RadiusValue,
	StylePreset,
	ThemeConfig,
	ThemeMode,
} from "./types";
import { DEFAULT_THEME_CONFIG, resolveThemeTokens } from "./types";

// =============================================================================
// THEME STORE - Server-side aware initialization
// =============================================================================

/**
 * Global store for theme configuration.
 *
 * SSR Strategy:
 * 1. Server initializes store with DEFAULT_THEME_CONFIG or value from cookie
 * 2. Server passes initial theme to RootDocument via route context
 * 3. RootDocument applies correct html class before rendering
 * 4. Client hydrates with matching initial state (no mismatch)
 * 5. ThemeProvider syncs with store and persists changes to cookies
 */
export const themeStore = new Store<ThemeConfig>(DEFAULT_THEME_CONFIG);

// Track if we've hydrated from server-provided initial state
let isInitialized = false;

/**
 * Initialize the theme store with server-provided initial state.
 * This should be called once on the server during SSR, or on the client
 * during hydration with the server's initial value.
 *
 * @param initialMode - The theme mode from the cookie (read on server)
 */
export function initializeThemeStore(initialMode: ThemeMode | null): void {
	if (isInitialized) return;
	isInitialized = true;

	if (initialMode !== null) {
		themeStore.setState(() => ({
			...DEFAULT_THEME_CONFIG,
			mode: initialMode,
		}));
	}
}

// =============================================================================
// PERSISTENCE - Cookie-based (CSP-compliant)
// =============================================================================

/**
 * Persist theme mode to cookie.
 * Called automatically when theme changes.
 */
function persistThemeMode(mode: ThemeMode): void {
	if (typeof window === "undefined") return;
	setThemeCookie(mode);
}

// Subscribe to mode changes and persist to cookie
themeStore.subscribe(() => {
	persistThemeMode(themeStore.state.mode);
});

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
 * Automatically persists to cookie via store subscription
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

// Legacy function - no longer needed with cookie-based approach
// Kept for backwards compatibility but does nothing
export const hydrateThemeFromStorage = (): void => {
	// No-op: theme is now initialized via initializeThemeStore()
	// and persisted via cookies, not localStorage
};
