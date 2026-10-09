import { create } from "zustand";
import type { DriveThruMicSettings, MicStatus } from "./settings";

/**
 * Station-side, in-memory record of what the drive-thru mic processing is doing.
 * Feeds the on-screen test panel and mirrors every line to the console.
 */

export type MicLogLevel = "info" | "ok" | "warn" | "error";

export type MicLogEntry = { id: number; time: number; level: MicLogLevel; text: string };

const MAX_ENTRIES = 150;
const CONSOLE_PREFIX = "[drive-thru-mic]";

interface MicLogState {
  /** Newest first. */
  entries: MicLogEntry[];
  status: MicStatus | null;
  settings: DriveThruMicSettings | null;
  /** `ok` false = the station could not fully apply it (shown amber, never as a success). */
  lastManagerChange: { time: number; text: string; ok: boolean } | null;
  log: (level: MicLogLevel, text: string) => void;
  setStatus: (status: MicStatus) => void;
  setSettings: (settings: DriveThruMicSettings) => void;
  setLastManagerChange: (text: string, ok?: boolean) => void;
}

let nextId = 1;

export const useMicLogStore = create<MicLogState>()((set) => ({
  entries: [],
  status: null,
  settings: null,
  lastManagerChange: null,

  log: (level, text) => {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(CONSOLE_PREFIX, text);
    set((s) => ({
      entries: [{ id: nextId++, time: Date.now(), level, text }, ...s.entries].slice(0, MAX_ENTRIES),
    }));
  },
  setStatus: (status) => set({ status }),
  setSettings: (settings) => set({ settings }),
  setLastManagerChange: (text, ok = true) => set({ lastManagerChange: { time: Date.now(), text, ok } }),
}));

/** Shorthand for non-React callers (processor, hooks' event handlers). */
export const micLog = (level: MicLogLevel, text: string) => useMicLogStore.getState().log(level, text);
