"use client";

import { Button } from "@/components/ui/button";
import { useNextTheme } from "@space-man/react-theme-animation";
import { SunMoon } from "lucide-react";

export function ThemeToggleAnimated() {
  const { theme, toggleTheme, ref } = useNextTheme();

  return (
    <Button variant="ghost" size="icon" asChild>
      <button
        ref={ref as any}
        onClick={() => toggleTheme()}
        aria-label="Toggle theme"
        title={theme === "light" ? "Switch to dark" : "Switch to light"}
        className="h-6 w-6 flex items-center justify-center"
      >
        <SunMoon className="h-4 w-4" />
      </button>
    </Button>
  );
}
