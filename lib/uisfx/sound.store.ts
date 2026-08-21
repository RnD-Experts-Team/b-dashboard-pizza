import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PackName } from "uisfx";
import { applyPack, applyVolume, applyEnabled, initUisfx } from "./sync";

/** SSR-safe no-op storage */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

interface SoundFxState {
  pack: PackName;
  volume: number;
  enabled: boolean;
  /** Whether the AudioContext has been unlocked by a trusted gesture this page load. Never persisted. */
  unlocked: boolean;

  setPack: (pack: PackName) => void;
  setVolume: (volume: number) => void;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  setUnlocked: (unlocked: boolean) => void;
}

export const useSoundFxStore = create<SoundFxState>()(
  persist(
    (set, get) => ({
      pack: "mechanical",
      volume: 0.6,
      enabled: true,
      unlocked: false,

      setPack: (pack) => {
        set({ pack });
        applyPack(pack);
      },
      setVolume: (volume) => {
        set({ volume });
        applyVolume(volume);
      },
      setEnabled: (enabled) => {
        set({ enabled });
        applyEnabled(enabled);
      },
      toggleEnabled: () => {
        const enabled = !get().enabled;
        set({ enabled });
        applyEnabled(enabled);
      },
      setUnlocked: (unlocked) => set({ unlocked }),
    }),
    {
      name: "sound-fx",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      // Never persist `unlocked` — the AudioContext doesn't survive reload and
      // must be re-armed by a fresh trusted gesture every page load.
      partialize: (state) => ({
        pack: state.pack,
        volume: state.volume,
        enabled: state.enabled,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          initUisfx(state);
        }
      },
    }
  )
);
