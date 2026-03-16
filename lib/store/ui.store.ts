import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage — avoids Node.js `--localstorage-file` warning */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

type Theme = "light" | "dark" | "system";

export type LayoutVariant = "classic" | "inset" | "floating" | "topnav";

interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  layoutVariant: LayoutVariant;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLayoutVariant: (variant: LayoutVariant) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      layoutVariant: "classic",

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme: Theme) => set({ theme }),

      setLayoutVariant: (variant: LayoutVariant) =>
        set({ layoutVariant: variant }),
    }),
    {
      name: "ui-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
