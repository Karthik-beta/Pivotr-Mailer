import { Moon, Sun, Monitor } from "lucide-react"
import { useThemeMode, setThemeMode } from "@/lib/theme"
import type { ThemeMode } from "@/lib/theme"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useResolvedTheme } from "./theme-provider"

const modeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle() {
    const mode = useThemeMode()
    const resolvedTheme = useResolvedTheme()
    const isDark = resolvedTheme === "dark"

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="relative overflow-hidden"
                    aria-label="Toggle theme"
                >
                    <Sun className="size-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute size-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
                {modeOptions.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => setThemeMode(option.value)}
                        className="gap-3"
                    >
                        <option.icon className="size-4" />
                        <span>{option.label}</span>
                        {mode === option.value && (
                            <span className="ml-auto size-1.5 rounded-full bg-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
