import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { hydrateThemeFromStorage, useResolvedTokens, useThemeConfig } from "@/lib/theme";
import { generateThemeCSS } from "@/lib/theme/colors";
import { FONT_META } from "@/lib/theme/types";

// Use useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useSystemTheme(): "light" | "dark" {
	// Always initialize with "light" for SSR hydration consistency
	// The server cannot detect system theme, so client must match server's initial value
	const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		// Detect actual system theme after hydration completes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		setSystemTheme(mediaQuery.matches ? "dark" : "light");

		const handleChange = (e: MediaQueryListEvent) => {
			setSystemTheme(e.matches ? "dark" : "light");
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	return systemTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const config = useThemeConfig();
	const tokens = useResolvedTokens();
	const systemTheme = useSystemTheme();

	// Hydrate theme store from localStorage after initial render
	// This must happen after hydration to avoid SSR/client mismatch
	useEffect(() => {
		hydrateThemeFromStorage();
	}, []);

	const resolvedMode = config.mode === "system" ? systemTheme : config.mode;
	const isDark = resolvedMode === "dark";

	// Generate theme CSS
	const themeCSS = useMemo(
		() => generateThemeCSS(tokens.colorTheme, tokens.radius, tokens.fontFamily, isDark),
		[tokens.colorTheme, tokens.radius, tokens.fontFamily, isDark]
	);

	// Get Google Fonts URL
	const googleFontsUrl = useMemo(() => {
		const fontConfig = FONT_META[tokens.fontFamily];
		if (!fontConfig) return null;
		return `https://fonts.googleapis.com/css2?family=${fontConfig.googleFont}&display=swap`;
	}, [tokens.fontFamily]);

	// Apply dark class to html element
	useIsomorphicLayoutEffect(() => {
		const html = document.documentElement;
		if (isDark) {
			html.classList.add("dark");
		} else {
			html.classList.remove("dark");
		}
	}, [isDark]);

	// Inject theme CSS variables
	useIsomorphicLayoutEffect(() => {
		let styleElement = document.getElementById("theme-variables") as HTMLStyleElement | null;
		if (!styleElement) {
			styleElement = document.createElement("style");
			styleElement.id = "theme-variables";
			document.head.appendChild(styleElement);
		}

		styleElement.textContent = `
            :root {
                ${themeCSS}
            }
            .dark {
                ${generateThemeCSS(tokens.colorTheme, tokens.radius, tokens.fontFamily, true)}
            }
            body {
                font-family: var(--font-family);
            }
        `;
	}, [themeCSS, tokens.colorTheme, tokens.radius, tokens.fontFamily]);

	// Load Google Fonts
	useEffect(() => {
		if (!googleFontsUrl) return;

		const linkId = "theme-google-font";
		let linkElement = document.getElementById(linkId) as HTMLLinkElement | null;

		if (!linkElement) {
			linkElement = document.createElement("link");
			linkElement.id = linkId;
			linkElement.rel = "stylesheet";
			document.head.appendChild(linkElement);
		}

		linkElement.href = googleFontsUrl;
	}, [googleFontsUrl]);

	return <>{children}</>;
}

// Export hook for accessing resolved theme
export function useResolvedTheme(): "light" | "dark" {
	const config = useThemeConfig();
	const systemTheme = useSystemTheme();
	return config.mode === "system" ? systemTheme : config.mode;
}
