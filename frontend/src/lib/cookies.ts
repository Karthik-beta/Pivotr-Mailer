import type { ThemeMode } from "@/lib/theme/types";

interface CookieStoreLike {
	set(options: {
		name: string;
		value: string;
		expires?: number | Date;
		path?: string;
		sameSite?: "strict" | "lax" | "none";
		secure?: boolean;
	}): Promise<void>;
	delete(options: { name: string; path?: string }): Promise<void>;
}

const toCookieStoreSameSite = (sameSite: CookieOptions["sameSite"]): "strict" | "lax" | "none" => {
	switch (sameSite) {
		case "Strict":
			return "strict";
		case "None":
			return "none";
		default:
			return "lax";
	}
};

const isCookieStoreLike = (value: unknown): value is CookieStoreLike =>
	typeof value === "object" &&
	value !== null &&
	"set" in value &&
	typeof value.set === "function" &&
	"delete" in value &&
	typeof value.delete === "function";

const getCookieStore = (): CookieStoreLike | null => {
	const candidate = Reflect.get(globalThis, "cookieStore");
	return isCookieStoreLike(candidate) ? candidate : null;
};

/**
 * Cookie options for document.cookie API
 */
interface CookieOptions {
	days?: number;
	path?: string;
	sameSite?: "Strict" | "Lax" | "None";
	secure?: boolean;
}

/**
 * Set a cookie using the Cookie Store API
 * Works on client-side only
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
	const cookieStore = getCookieStore();
	if (!cookieStore) return;

	const { days = 365, path = "/", sameSite = "Lax", secure = true } = options;
	const expires = days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : undefined;
	void cookieStore.set({
		name: encodeURIComponent(name),
		value: encodeURIComponent(value),
		expires,
		path,
		sameSite: toCookieStoreSameSite(sameSite),
		secure,
	});
}

/**
 * Get a cookie value by name
 * Works on both client and server (with request object)
 */
export function getCookie(name: string, cookieHeader?: string): string | null {
	const cookieName = encodeURIComponent(name);

	// Server-side: parse from cookie header string
	if (cookieHeader) {
		const cookies = parseCookieHeader(cookieHeader);
		const value = cookies.get(cookieName);
		return value ? decodeURIComponent(value) : null;
	}

	// Client-side: use document.cookie
	if (typeof document !== "undefined") {
		const cookies = parseCookieHeader(document.cookie);
		const value = cookies.get(cookieName);
		return value ? decodeURIComponent(value) : null;
	}

	return null;
}

/**
 * Parse a cookie header string into a Map
 */
function parseCookieHeader(cookieHeader: string): Map<string, string> {
	const cookies = new Map<string, string>();

	if (!cookieHeader) return cookies;

	const pairs = cookieHeader.split(";");

	for (const pair of pairs) {
		const trimmed = pair.trim();
		if (!trimmed) continue;

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex === -1) continue;

		const name = trimmed.slice(0, separatorIndex);
		const value = trimmed.slice(separatorIndex + 1);
		cookies.set(name, value);
	}

	return cookies;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, path = "/"): void {
	const cookieStore = getCookieStore();
	if (!cookieStore) return;
	void cookieStore.delete({ name: encodeURIComponent(name), path });
}

// =============================================================================
// Theme-specific cookie utilities
// =============================================================================

const THEME_COOKIE_NAME = "pivotr-theme";

/**
 * Parse theme mode from cookie value
 * Returns the stored theme mode or null if not set
 */
export function parseThemeCookie(cookieValue: string | null): ThemeMode | null {
	if (!cookieValue) return null;

	// Try to parse as JSON (new format with full config)
	try {
		const parsed = JSON.parse(cookieValue);
		if (typeof parsed === "object" && parsed !== null && "mode" in parsed) {
			const mode = parsed.mode;
			if (mode === "light" || mode === "dark" || mode === "system") {
				return mode;
			}
		}
	} catch {
		// Not JSON, try as plain string (legacy format)
	}

	// Legacy format: just the mode string
	if (cookieValue === "light" || cookieValue === "dark" || cookieValue === "system") {
		return cookieValue;
	}

	return null;
}

/**
 * Get theme mode from cookie
 * Works on both server (with cookie header) and client
 */
export function getThemeFromCookie(cookieHeader?: string): ThemeMode | null {
	const value = getCookie(THEME_COOKIE_NAME, cookieHeader);
	return parseThemeCookie(value);
}

/**
 * Set theme mode cookie
 * Only works on client-side
 */
export function setThemeCookie(mode: ThemeMode): void {
	setCookie(THEME_COOKIE_NAME, JSON.stringify({ mode }), {
		days: 365,
		sameSite: "Lax",
		secure: true,
	});
}

/**
 * Resolve the effective theme (light or dark) from mode and system preference
 * On server, system preference is unknown, so we default to light for "system"
 */
export function resolveEffectiveTheme(
	mode: ThemeMode,
	systemPrefersDark?: boolean
): "light" | "dark" {
	if (mode === "dark") return "dark";
	if (mode === "light") return "light";
	// For "system" mode, use system preference if available, otherwise default to light
	return systemPrefersDark === true ? "dark" : "light";
}
