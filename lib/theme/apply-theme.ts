import type { Theme, ThemeColors } from "./types";

/**
 * The single localStorage key both theme-mode engines must share
 * (next-themes' own ThemeProvider and @space-man/react-theme-animation's
 * NextThemeProvider) — they independently toggle the same `.dark` class on
 * `document.documentElement`, and if they read/write different keys they
 * disagree about which mode is active. See components/providers/feature-providers.tsx.
 */
export const THEME_STORAGE_KEY = "color-mode";

// CSS variable names that map to theme color properties
export const COLOR_VAR_MAP: Record<keyof ThemeColors, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
  skeletonBase: "--skeleton-base",
  skeletonHighlight: "--skeleton-highlight",
  scrollbarThumb: "--scrollbar-thumb",
  scrollbarTrack: "--scrollbar-track",
  shellBackground: "--shell-background",
};

/**
 * Apply a color palette to the document root
 */
function applyColorPalette(colors: ThemeColors) {
  const root = document.documentElement;
  
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
    const value = colors[key as keyof ThemeColors];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }
}

/**
 * Apply radius to the document root
 */
function applyRadius(radius: string) {
  document.documentElement.style.setProperty("--radius", radius);
}

/**
 * Get the current color mode (light/dark)
 */
export function getCurrentMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  // Explicit mode class on documentElement (next-themes sets "light" or "dark"
  // when attribute="class"). An explicit class always wins — the OS preference
  // must not override a theme the user (or the app) has deliberately chosen.
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    return "dark";
  }
  if (root.classList.contains("light")) {
    return "light";
  }

  // No explicit class yet — fall back to the OS preference.
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

/**
 * Apply a theme to the document
 * This sets CSS custom properties based on the current color mode
 */
export function applyTheme(theme: Theme, mode?: "light" | "dark") {
  if (typeof window === "undefined") return;
  
  const currentMode = mode ?? getCurrentMode();
  const colors = currentMode === "dark" ? theme.colors.dark : theme.colors.light;
  
  applyColorPalette(colors);
  applyRadius(theme.radius.base);
  
  // Store applied theme ID for FOUC prevention
  document.documentElement.setAttribute("data-theme-id", theme.id);
}

/**
 * Generate CSS string from a theme (for export/preview)
 */
export function generateThemeCSS(theme: Theme): string {
  const lines: string[] = [];
  
  lines.push("/* Theme: " + theme.name + " */");
  lines.push("/* Version: " + theme.version + " */");
  lines.push("");
  
  // Light mode
  lines.push(":root {");
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
    const value = theme.colors.light[key as keyof ThemeColors];
    if (value) {
      lines.push(`  ${cssVar}: ${value};`);
    }
  }
  lines.push(`  --radius: ${theme.radius.base};`);
  lines.push("}");
  lines.push("");
  
  // Dark mode
  lines.push(".dark {");
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
    const value = theme.colors.dark[key as keyof ThemeColors];
    if (value) {
      lines.push(`  ${cssVar}: ${value};`);
    }
  }
  lines.push("}");
  
  return lines.join("\n");
}

/**
 * Reset theme to CSS defaults (remove inline styles)
 */
export function resetThemeStyles() {
  if (typeof window === "undefined") return;
  
  const root = document.documentElement;
  
  for (const cssVar of Object.values(COLOR_VAR_MAP)) {
    root.style.removeProperty(cssVar);
  }
  root.style.removeProperty("--radius");
  root.removeAttribute("data-theme-id");
}

/**
 * Create an inline script for FOUC prevention
 * This should be injected into the <head> before any content
 */
export function createFOUCPreventionScript(): string {
  return `
(function() {
  try {
    var stored = localStorage.getItem('theme-storage');
    if (stored) {
      var state = JSON.parse(stored);
      if (state.state && state.state.activeTheme) {
        var theme = state.state.activeTheme;
        // Read the saved mode directly — at this point (before next-themes'
        // own script has run) the 'dark' class never exists yet, so checking
        // for it here always falls through to the OS preference and ignores
        // whatever the user actually chose. next-themes stores a bare string
        // ('dark' | 'light' | 'system'), not JSON.
        var modeStored = localStorage.getItem('${THEME_STORAGE_KEY}');
        var isDark = modeStored === 'dark' ||
          (modeStored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        var colors = isDark ? theme.colors.dark : theme.colors.light;
        var root = document.documentElement;
        
        // Apply colors
        var colorMap = ${JSON.stringify(COLOR_VAR_MAP)};
        for (var key in colorMap) {
          if (colors[key]) {
            root.style.setProperty(colorMap[key], colors[key]);
          }
        }
        
        // Apply radius
        if (theme.radius && theme.radius.base) {
          root.style.setProperty('--radius', theme.radius.base);
        }
        
        root.setAttribute('data-theme-id', theme.id);
      }
    }
  } catch (e) {
    console.warn('Theme FOUC prevention failed:', e);
  }
})();
`.trim();
}
