import { create } from "zustand";
import {
  sensorService,
  SensorError,
} from "@/lib/api/services/sensor.service";
import type {
  SensorsResponse,
  ReportsResponse,
  HistoryResponse,
  AlertsResponse,
  ReportPeriod,
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

  /* ── Reports ──────────────────────────────────────────────────────────── */
  reports: ReportsResponse | null;
  reportsLoading: boolean;
  reportsError: SensorErrorState | null;
  reportPeriod: ReportPeriod;

  /* ── History ──────────────────────────────────────────────────────────── */
  history: HistoryResponse | null;
  historyLoading: boolean;
  historyError: SensorErrorState | null;

  /* ── Alerts ───────────────────────────────────────────────────────────── */
  alerts: AlertsResponse | null;
  alertsLoading: boolean;
  alertsError: SensorErrorState | null;

  /* ── Metadata ─────────────────────────────────────────────────────────── */
  lastStoreId: string | null;
  lastFetchedAt: number | null;

  /* ── Temperature unit toggle (°F ↔ °C) ────────────────────────────────── */
  useCelsius: boolean;

  /* ── Actions ──────────────────────────────────────────────────────────── */
  fetchSensors: (storeId: string) => Promise<void>;
  fetchReports: (storeId: string, period?: ReportPeriod) => Promise<void>;
  fetchHistory: (storeId: string, page?: number, perPage?: number) => Promise<void>;
  fetchAlerts: (storeId: string, from?: string, to?: string) => Promise<void>;
  fetchAll: (storeId: string) => Promise<void>;
  setReportPeriod: (period: ReportPeriod) => void;
  toggleUnit: () => void;
  clearErrors: () => void;
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

  reports: null,
  reportsLoading: false,
  reportsError: null,
  reportPeriod: "daily",

  history: null,
  historyLoading: false,
  historyError: null,

  alerts: null,
  alertsLoading: false,
  alertsError: null,

  lastStoreId: null,
  lastFetchedAt: null,
  useCelsius: false,

  /* ── Fetch live sensors ───────────────────────────────────────────────── */
  fetchSensors: async (storeId: string) => {
    _abortController?.abort();
    _abortController = new AbortController();
    set({ sensorsLoading: true, sensorsError: null });
    try {
      const data = await sensorService.getSensors(storeId, _abortController.signal);
      set({ sensors: data, sensorsLoading: false, lastStoreId: storeId, lastFetchedAt: Date.now() });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ sensorsLoading: false, sensorsError: toErrorState(err) });
    }
  },

  /* ── Fetch aggregated reports ─────────────────────────────────────────── */
  fetchReports: async (storeId: string, period?: ReportPeriod) => {
    const p = period ?? get().reportPeriod;
    set({ reportsLoading: true, reportsError: null, reportPeriod: p });
    try {
      const data = await sensorService.getReports(storeId, p, _abortController?.signal);
      set({ reports: data, reportsLoading: false });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ reportsLoading: false, reportsError: toErrorState(err) });
    }
  },

  /* ── Fetch reading history (paginated) ────────────────────────────────── */
  fetchHistory: async (storeId: string, page = 1, perPage = 20) => {
    set({ historyLoading: true, historyError: null });
    try {
      const data = await sensorService.getHistory(storeId, { page, per_page: perPage }, _abortController?.signal);
      set({ history: data, historyLoading: false });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ historyLoading: false, historyError: toErrorState(err) });
    }
  },

  /* ── Fetch alert records ──────────────────────────────────────────────── */
  fetchAlerts: async (storeId: string, from?: string, to?: string) => {
    set({ alertsLoading: true, alertsError: null });
    try {
      const data = await sensorService.getAlerts(storeId, { from, to }, _abortController?.signal);
      set({ alerts: data, alertsLoading: false });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({ alertsLoading: false, alertsError: toErrorState(err) });
    }
  },

  /* ── Fetch all endpoints in parallel ──────────────────────────────────── */
  fetchAll: async (storeId: string) => {
    _abortController?.abort();
    _abortController = new AbortController();

    // Reset errors & set all loaders
    set({
      sensorsLoading: true,
      reportsLoading: true,
      historyLoading: true,
      alertsLoading: true,
      sensorsError: null,
      reportsError: null,
      historyError: null,
      alertsError: null,
      lastStoreId: storeId,
    });

    const signal = _abortController.signal;
    const period = get().reportPeriod;

    // Default alert range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const toDate = now.toISOString().slice(0, 10);
    const fromDate = weekAgo.toISOString().slice(0, 10);

    // Fire all requests concurrently — each resolves independently
    const [sensorsResult, reportsResult, historyResult, alertsResult] = await Promise.allSettled([
      sensorService.getSensors(storeId, signal),
      sensorService.getReports(storeId, period, signal),
      sensorService.getHistory(storeId, { per_page: 20 }, signal),
      sensorService.getAlerts(storeId, { from: fromDate, to: toDate }, signal),
    ]);

    // Map each settled result: update data on success, error on failure
    set({
      sensors: sensorsResult.status === "fulfilled" ? sensorsResult.value : null,
      sensorsLoading: false,
      sensorsError: sensorsResult.status === "rejected" && !axios.isCancel(sensorsResult.reason)
        ? toErrorState(sensorsResult.reason)
        : null,

      reports: reportsResult.status === "fulfilled" ? reportsResult.value : null,
      reportsLoading: false,
      reportsError: reportsResult.status === "rejected" && !axios.isCancel(reportsResult.reason)
        ? toErrorState(reportsResult.reason)
        : null,

      history: historyResult.status === "fulfilled" ? historyResult.value : null,
      historyLoading: false,
      historyError: historyResult.status === "rejected" && !axios.isCancel(historyResult.reason)
        ? toErrorState(historyResult.reason)
        : null,

      alerts: alertsResult.status === "fulfilled" ? alertsResult.value : null,
      alertsLoading: false,
      alertsError: alertsResult.status === "rejected" && !axios.isCancel(alertsResult.reason)
        ? toErrorState(alertsResult.reason)
        : null,

      lastFetchedAt: Date.now(),
    });
  },

  setReportPeriod: (period: ReportPeriod) => set({ reportPeriod: period }),

  toggleUnit: () => set((s) => ({ useCelsius: !s.useCelsius })),

  clearErrors: () =>
    set({ sensorsError: null, reportsError: null, historyError: null, alertsError: null }),

  reset: () => {
    _abortController?.abort();
    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    set({
      sensors: null,
      sensorsLoading: false,
      sensorsError: null,
      reports: null,
      reportsLoading: false,
      reportsError: null,
      history: null,
      historyLoading: false,
      historyError: null,
      alerts: null,
      alertsLoading: false,
      alertsError: null,
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
        get().fetchAll(lastStoreId);
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
