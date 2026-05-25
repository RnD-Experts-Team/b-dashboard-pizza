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
  | "ibmPlexMono"
  | "oswald"
  | "instrumentSans";

interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  layoutVariant: LayoutVariant;
  /** Font applied to headings (h1–h6) */
  primaryFont: FontVariant;
  /** Font applied to body / general text */
  secondaryFont: FontVariant;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLayoutVariant: (variant: LayoutVariant) => void;
  setPrimaryFont: (variant: FontVariant) => void;
  setSecondaryFont: (variant: FontVariant) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: "system",
      layoutVariant: "classic",
      primaryFont: "oswald",
      secondaryFont: "instrumentSans",

      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme: Theme) => set({ theme }),

      setLayoutVariant: (variant: LayoutVariant) =>
        set({ layoutVariant: variant }),

      setPrimaryFont: (variant: FontVariant) => set({ primaryFont: variant }),

      setSecondaryFont: (variant: FontVariant) => set({ secondaryFont: variant }),
    }),
    {
      name: "ui-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
