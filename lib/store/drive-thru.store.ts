import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** SSR-safe no-op storage */
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export interface DriveThruConnection {
  roomName: string;
  name: string;
  token: string;
  serverUrl: string;
  storeId: string;
  stationId: number;
}

interface DriveThruState {
  /** Active drive-thru connection. null = not connected. */
  connection: DriveThruConnection | null;
  /** Whether the slide-in sheet is currently shown. */
  isSheetOpen: boolean;
  /** Whether incoming drive-thru audio is muted. */
  isMuted: boolean;
  /** Guards against concurrent/duplicate connect() calls (e.g. double click). */
  isConnecting: boolean;
  /** Whether the LiveKit room is actually connected — drives the button's red/green state. */
  isLive: boolean;
  /** Bumped whenever the token is refreshed, used as ScreenTile's `key` to force a clean reconnect. */
  connectionAttempt: number;

  connect: (station: DriveThruConnection) => void;
  disconnect: () => void;
  openSheet: () => void;
  closeSheet: () => void;
  toggleSheet: () => void;
  toggleMute: () => void;
  setConnecting: (v: boolean) => void;
  setLive: (v: boolean) => void;
  /** Swap in a freshly-fetched token without dropping isSheetOpen/isMuted state. */
  refreshToken: (token: string) => void;
  bumpConnectionAttempt: () => void;
}

export const useDriveThruStore = create<DriveThruState>()(
  persist(
    (set) => ({
      connection: null,
      isSheetOpen: false,
      isMuted: false,
      isConnecting: false,
      isLive: false,
      connectionAttempt: 0,

      connect: (station) =>
        set((state) => ({
          connection: station,
          isConnecting: false,
          connectionAttempt: state.connectionAttempt + 1,
        })),

      disconnect: () =>
        set({ connection: null, isSheetOpen: false, isLive: false, isConnecting: false }),

      openSheet: () => set({ isSheetOpen: true }),
      closeSheet: () => set({ isSheetOpen: false }),
      toggleSheet: () => set((state) => ({ isSheetOpen: !state.isSheetOpen })),

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      setConnecting: (v) => set({ isConnecting: v }),
      setLive: (v) => set({ isLive: v }),

      refreshToken: (token) =>
        set((state) => ({
          connection: state.connection ? { ...state.connection, token } : state.connection,
          connectionAttempt: state.connectionAttempt + 1,
        })),

      bumpConnectionAttempt: () =>
        set((state) => ({ connectionAttempt: state.connectionAttempt + 1 })),
    }),
    {
      name: "drive-thru",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
      // Only persist UI preference — never the connection/token (it expires and
      // a stale reconnect-on-reload would silently join as a stale participant).
      partialize: (state) => ({
        isMuted: state.isMuted,
      }),
    }
  )
);
