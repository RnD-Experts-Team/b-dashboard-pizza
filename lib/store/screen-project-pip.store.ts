import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { VideoQuality } from "livekit-client";

/** SSR-safe no-op storage */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export interface PiPStation {
  roomName: string;
  name: string;
  token: string;
  serverUrl: string;
  storeId: string;
}

interface PiPPosition {
  x: number;
  y: number;
}

/** Default: top-right corner with 16px padding from viewport edges. */
const DEFAULT_POSITION: PiPPosition = { x: -16, y: 16 };

interface ScreenProjectPiPState {
  /** Metadata for the active station to stream in PiP. null = no PiP active. */
  activeStation: PiPStation | null;
  /** Whether the PiP overlay is visible (false when minimized/closed). */
  isVisible: boolean;
  /** Whether remote station audio is muted in the PiP player. */
  isMuted: boolean;
  /** Whether the supervisor's microphone is published into the PiP room. */
  isMicEnabled: boolean;
  /** Whether the supervisor's camera is published into the PiP room. */
  isCamEnabled: boolean;
  /** Last user drag position (offset from top-right corner). Persisted. */
  position: PiPPosition;
  /** Video quality for the PiP stream. Always LOW. */
  videoQuality: VideoQuality;

  activatePiP: (station: PiPStation) => void;
  closePiP: () => void;
  toggleMute: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  setPosition: (pos: PiPPosition) => void;
}

export const useScreenProjectPiPStore = create<ScreenProjectPiPState>()(
  persist(
    (set) => ({
      activeStation: null,
      isVisible: false,
      isMuted: false,
      isMicEnabled: false,
      isCamEnabled: false,
      position: DEFAULT_POSITION,
      videoQuality: VideoQuality.LOW,

      activatePiP: (station) =>
        set({ activeStation: station, isVisible: true }),

      closePiP: () =>
        set({ activeStation: null, isVisible: false, isMicEnabled: false, isCamEnabled: false }),

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      toggleMic: () => set((state) => ({ isMicEnabled: !state.isMicEnabled })),

      toggleCam: () => set((state) => ({ isCamEnabled: !state.isCamEnabled })),

      setPosition: (pos) => set({ position: pos }),
    }),
    {
      name: "screen-project-pip",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      // Only persist UI preferences, never the token (it expires)
      partialize: (state) => ({
        position: state.position,
        isMuted: state.isMuted,
      }),
    }
  )
);
