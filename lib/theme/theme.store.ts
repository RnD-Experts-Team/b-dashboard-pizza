"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Theme, ThemeState } from "./types";
import { defaultTheme, obsidianTheme, builtInThemes } from "./default-theme";
import { applyTheme, resetThemeStyles, getCurrentMode } from "./apply-theme";
import { validateTheme } from "./schema";

const STORAGE_KEY = "theme-storage";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface ThemeStore extends ThemeState {
  // Actions
  setActiveTheme: (themeId: string) => void;
  addTheme: (theme: Theme) => void;
  updateTheme: (themeId: string, updates: Partial<Theme>) => void;
  deleteTheme: (themeId: string) => void;
  importTheme: (json: string) => { success: boolean; error?: string; theme?: Theme };
  exportTheme: (themeId: string) => string | null;
  resetToDefault: () => void;
  applyActiveTheme: () => void;
  
  // Sync status
  setSyncPending: (pending: boolean) => void;
  setLastSynced: (date: Date | null) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      themes: [...builtInThemes],
      activeThemeId: obsidianTheme.id,
      activeTheme: obsidianTheme,
      syncPending: false,
      lastSynced: null,

      // Set active theme by ID
      setActiveTheme: (themeId: string) => {
        const { themes } = get();
        const theme = themes.find((t) => t.id === themeId);
        
        if (!theme) {
          console.warn(`Theme with id "${themeId}" not found`);
          return;
        }
        
        set({
          activeThemeId: themeId,
          activeTheme: theme,
          syncPending: true,
        });
        
        // Apply theme to DOM
        applyTheme(theme);
      },

      // Add a new theme
      addTheme: (theme: Theme) => {
        const { themes } = get();
        
        // Check for duplicate ID
        if (themes.some((t) => t.id === theme.id)) {
          console.warn(`Theme with id "${theme.id}" already exists`);
          return;
        }
        
        set({
          themes: [...themes, theme],
          syncPending: true,
        });
      },

      // Update an existing theme
      updateTheme: (themeId: string, updates: Partial<Theme>) => {
        const { themes, activeThemeId } = get();
        const themeIndex = themes.findIndex((t) => t.id === themeId);
        
        if (themeIndex === -1) {
          console.warn(`Theme with id "${themeId}" not found`);
          return;
        }
        
        // Don't allow modifying built-in theme IDs
        if (themes[themeIndex].isDefault && updates.id) {
          console.warn("Cannot change ID of built-in themes");
          return;
        }
        
        const updatedTheme = { ...themes[themeIndex], ...updates };
        const newThemes = [...themes];
        newThemes[themeIndex] = updatedTheme;
        
        const newState: Partial<ThemeStore> = {
          themes: newThemes,
          syncPending: true,
        };
        
        // If we updated the active theme, update activeTheme too
        if (themeId === activeThemeId) {
          newState.activeTheme = updatedTheme;
          applyTheme(updatedTheme);
        }
        
        set(newState);
      },

      // Delete a theme
      deleteTheme: (themeId: string) => {
        const { themes, activeThemeId } = get();
        const theme = themes.find((t) => t.id === themeId);
        
        if (!theme) {
          console.warn(`Theme with id "${themeId}" not found`);
          return;
        }
        
        if (theme.isDefault) {
          console.warn("Cannot delete built-in themes");
          return;
        }
        
        const newThemes = themes.filter((t) => t.id !== themeId);
        
        // If deleting the active theme, switch to default
        if (themeId === activeThemeId) {
          set({
            themes: newThemes,
            activeThemeId: defaultTheme.id,
            activeTheme: defaultTheme,
            syncPending: true,
          });
          applyTheme(defaultTheme);
        } else {
          set({
            themes: newThemes,
            syncPending: true,
          });
        }
      },

      // Import a theme from JSON
      importTheme: (json: string) => {
        try {
          const parsed = JSON.parse(json);
          const result = validateTheme(parsed);
          
          if (!result.success) {
            return {
              success: false,
              error: result.error || "Invalid theme format",
            };
          }
          
          const theme = result.data as Theme;
          const { themes } = get();
          
          // Generate new ID if it conflicts
          let themeId = theme.id || `custom-${Date.now()}`;
          let counter = 1;
          while (themes.some((t) => t.id === themeId)) {
            themeId = `${theme.id || "custom"}-${counter++}`;
          }
          
          const newTheme: Theme = {
            ...theme,
            id: themeId,
            isDefault: false,
          };
          
          set({
            themes: [...themes, newTheme],
            syncPending: true,
          });
          
          return { success: true, theme: newTheme };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : "Failed to parse JSON",
          };
        }
      },

      // Export a theme as JSON
      exportTheme: (themeId: string) => {
        const { themes } = get();
        const theme = themes.find((t) => t.id === themeId);
        
        if (!theme) {
          console.warn(`Theme with id "${themeId}" not found`);
          return null;
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isDefault, ...exportData } = theme;
        return JSON.stringify(exportData, null, 2);
      },

      // Reset to default theme
      resetToDefault: () => {
        resetThemeStyles();
        set({
          activeThemeId: defaultTheme.id,
          activeTheme: defaultTheme,
          syncPending: true,
        });
        applyTheme(defaultTheme);
      },

      // Apply the current active theme (useful on mount)
      applyActiveTheme: () => {
        const { activeTheme } = get();
        if (activeTheme) {
          applyTheme(activeTheme, getCurrentMode());
        }
      },

      // Sync status setters
      setSyncPending: (pending: boolean) => set({ syncPending: pending }),
      setLastSynced: (date: Date | null) => set({ lastSynced: date }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      partialize: (state) => ({
        themes: state.themes,
        activeThemeId: state.activeThemeId,
        activeTheme: state.activeTheme,
        lastSynced: state.lastSynced,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme after hydration
        if (state?.activeTheme) {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            applyTheme(state.activeTheme, getCurrentMode());
          }, 0);
        }
      },
    }
  )
);

// Hook to listen for system color scheme changes and re-apply theme
export function useThemeColorSchemeListener() {
  const applyActiveTheme = useThemeStore((state) => state.applyActiveTheme);
  
  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      applyActiveTheme();
    });
  }
}
