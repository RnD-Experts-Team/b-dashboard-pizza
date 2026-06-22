import { create } from "zustand";
import {
  sensorService,
  SensorError,
} from "@/lib/api/services/sensor.service";
import type {
  SensorsResponse,
  BulkSensorsResponse,
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
  mosSensors: BulkSensorsResponse | null;
  sensorsLoading: boolean;
  sensorsError: SensorErrorState | null;

  /* ── Fetch mode ───────────────────────────────────────────────────────── */
  mode: "store" | "mos";

  /* ── Metadata ─────────────────────────────────────────────────────────── */
  lastStoreId: string | null;
  lastStoreIds: string[] | null;
  lastFetchedAt: number | null;

  /* ── Temperature unit toggle (°F ↔ °C) ────────────────────────────────── */
  useCelsius: boolean;

  /* ── Actions ──────────────────────────────────────────────────────────── */
  fetchSensors: (storeIdOrIds: string | string[], unit?: "c" | "f") => Promise<void>;
  setMode: (mode: "store" | "mos") => void;
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
  mosSensors: null,
  sensorsLoading: false,
  sensorsError: null,

  mode: "store",

  lastStoreId: null,
  lastStoreIds: null,
  lastFetchedAt: null,
  useCelsius: true,

  /* ── Fetch live sensors (single store or bulk MOS) ────────────────────── */
  fetchSensors: async (storeIdOrIds, unit?) => {
    const mode = get().mode;
    _abortController?.abort();
    _abortController = new AbortController();
    set({ sensorsLoading: true, sensorsError: null });
    const u = unit ?? (get().useCelsius ? "c" : "f");

    try {
      if (mode === "mos") {
        const ids = Array.isArray(storeIdOrIds) ? storeIdOrIds : [storeIdOrIds];
        const data = await sensorService.getMosSensors(ids, u, _abortController.signal);
        set({ mosSensors: data, sensors: null, sensorsLoading: false, lastStoreIds: ids, lastFetchedAt: Date.now() });
      } else {
        const storeId = Array.isArray(storeIdOrIds) ? storeIdOrIds[0] : storeIdOrIds;
        const data = await sensorService.getSensors(storeId, u, _abortController.signal);
        set({ sensors: data, mosSensors: null, sensorsLoading: false, lastStoreId: storeId, lastFetchedAt: Date.now() });
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ sensorsLoading: false, sensorsError: toErrorState(err) });
    }
  },

  setMode: (mode) => {
    set({ mode });
  },

  toggleUnit: () => {
    const s = get();
    const newUseCelsius = !s.useCelsius;
    set({ useCelsius: newUseCelsius });
    const unit = newUseCelsius ? "c" : "f";
    if (s.mode === "mos" && s.lastStoreIds) {
      s.fetchSensors(s.lastStoreIds, unit);
    } else if (s.lastStoreId) {
      s.fetchSensors(s.lastStoreId, unit);
    }
  },

  reset: () => {
    _abortController?.abort();
    if (_autoRefreshTimer) {
      clearInterval(_autoRefreshTimer);
      _autoRefreshTimer = null;
    }
    set({
      sensors: null,
      mosSensors: null,
      sensorsLoading: false,
      sensorsError: null,
      lastStoreId: null,
      lastStoreIds: null,
      lastFetchedAt: null,
    });
  },

  /* ── Auto-refresh lifecycle ───────────────────────────────────────────── */
  startAutoRefresh: () => {
    if (_autoRefreshTimer) return;
    _autoRefreshTimer = setInterval(() => {
      const { mode, lastStoreId, lastStoreIds, isStale } = get();
      if (!isStale()) return;
      if (mode === "mos" && lastStoreIds) {
        get().fetchSensors(lastStoreIds);
      } else if (lastStoreId) {
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
