import { create } from "zustand";
import {
  sensorService,
  SensorError,
} from "@/lib/api/services/sensor.service";
import type {
  SensorsResponse,
  SensorErrorCode,
} from "@/types/sensor.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const STALE_AFTER_MS = 2 * 60 * 1000;
const AUTO_REFRESH_MS = 3 * 60 * 1000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SensorErrorState {
  message: string;
  code: SensorErrorCode;
  retryable: boolean;
}

interface SensorStoreState {
  /* ── Live sensor data ─────────────────────────────────────────────────── */
  sensors: SensorsResponse | null;
  sensorsLoading: boolean;
  sensorsError: SensorErrorState | null;

  /* ── Metadata ─────────────────────────────────────────────────────────── */
  lastStoreId: string | null;
  lastFetchedAt: number | null;

  /* ── Temperature unit toggle (°F ↔ °C) ────────────────────────────────── */
  useCelsius: boolean;

  /* ── Actions ──────────────────────────────────────────────────────────── */
  fetchSensors: (storeId: string, unit?: "c" | "f") => Promise<void>;
  toggleUnit: () => void;
  reset: () => void;

  /* ── Auto-refresh ─────────────────────────────────────────────────────── */
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  isStale: () => boolean;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal state (outside Zustand for setInterval / AbortController)      */
/* ────────────────────────────────────────────────────────────────────────── */

let _autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
let _abortController: AbortController | null = null;

/** Convert a caught error into a UI-friendly SensorErrorState */
function toErrorState(err: unknown): SensorErrorState {
  if (err instanceof SensorError) {
    return { message: err.message, code: err.code, retryable: err.retryable };
  }
  return {
    message: err instanceof Error ? err.message : "Unknown error",
    code: "UNKNOWN",
    retryable: false,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const useSensorStore = create<SensorStoreState>()((set, get) => ({
  sensors: null,
  sensorsLoading: false,
  sensorsError: null,

  lastStoreId: null,
  lastFetchedAt: null,
  useCelsius: true,

  /* ── Fetch live sensors ───────────────────────────────────────────────── */
  fetchSensors: async (storeId: string, unit?: "c" | "f") => {
    _abortController?.abort();
    _abortController = new AbortController();
    set({ sensorsLoading: true, sensorsError: null });
    const u = unit ?? (get().useCelsius ? "c" : "f");
    try {
      const data = await sensorService.getSensors(storeId, u, _abortController.signal);
      set({ sensors: data, sensorsLoading: false, lastStoreId: storeId, lastFetchedAt: Date.now() });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ sensorsLoading: false, sensorsError: toErrorState(err) });
    }
  },

  toggleUnit: () => {
    const s = get();
    const newUseCelsius = !s.useCelsius;
    set({ useCelsius: newUseCelsius });
    if (s.lastStoreId) {
      s.fetchSensors(s.lastStoreId, newUseCelsius ? "c" : "f");
    }
  },

  reset: () => {
    _abortController?.abort();
    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    set({
      sensors: null,
      sensorsLoading: false,
      sensorsError: null,
      lastStoreId: null,
      lastFetchedAt: null,
    });
  },

  /* ── Auto-refresh lifecycle ───────────────────────────────────────────── */
  startAutoRefresh: () => {
    if (_autoRefreshTimer) return;
    _autoRefreshTimer = setInterval(() => {
      const { lastStoreId, isStale } = get();
      if (lastStoreId && isStale()) {
        get().fetchSensors(lastStoreId);
      }
    }, AUTO_REFRESH_MS);
  },

  stopAutoRefresh: () => {
    if (_autoRefreshTimer) {
      clearInterval(_autoRefreshTimer);
      _autoRefreshTimer = null;
    }
  },

  isStale: () => {
    const { lastFetchedAt } = get();
    if (!lastFetchedAt) return true;
    return Date.now() - lastFetchedAt > STALE_AFTER_MS;
  },
}));

/* ── Need axios.isCancel at module scope for the store callbacks ────────── */
import axios from "axios";
