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

export type FontVariant =
  | "default"
  | "spaceGrotesk"
  | "playfairDisplay"
  | "ibmPlexMono";

interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  layoutVariant: LayoutVariant;
  fontVariant: FontVariant;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLayoutVariant: (variant: LayoutVariant) => void;
  setFontVariant: (variant: FontVariant) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      layoutVariant: "classic",
      fontVariant: "default",

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme: Theme) => set({ theme }),

      setLayoutVariant: (variant: LayoutVariant) =>
        set({ layoutVariant: variant }),

      setFontVariant: (variant: FontVariant) => set({ fontVariant: variant }),
    }),
    {
      name: "ui-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
