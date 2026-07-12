"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const icon =
    theme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : theme === "system" ? (
      <Monitor className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );

  return (
    <button
      onClick={cycle}
      className={cn(
        "glass-light h-8 w-8 rounded-lg",
        "flex items-center justify-center",
        "text-muted-foreground hover:text-foreground transition-colors"
      )}
      aria-label="Toggle theme"
    >
      {icon}
    </button>
  );
}
