import axios from "axios";
import type {
  SensorsResponse,
  ReportsResponse,
  HistoryResponse,
  AlertsResponse,
  ReportPeriod,
  HistoryQueryParams,
  AlertsQueryParams,
  SensorErrorCode,
} from "@/types/sensor.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Custom Error                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export class SensorError extends Error {
  readonly code: SensorErrorCode;
  readonly retryable: boolean;

  constructor(message: string, code: SensorErrorCode) {
    super(message);
    this.name = "SensorError";
    this.code = code;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper — reads the Zustand-persisted token from localStorage       */
/* ────────────────────────────────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Axios error → SensorError mapping                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function mapAxiosError(err: unknown): never {
  if (axios.isCancel(err)) throw err; // let callers handle cancellation

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    const msg = data?.error?.message;

    if (status === 401) throw new SensorError(msg || "Authentication failed.", "UNAUTHORIZED");
    if (status === 403) throw new SensorError(msg || "Access denied.", "FORBIDDEN");
    if (status === 404) throw new SensorError(msg || "Not found.", "NOT_FOUND");
    if (status === 429) throw new SensorError(msg || "Rate limited.", "RATE_LIMITED");
    if (!err.response || err.code === "ERR_NETWORK") {
      throw new SensorError("Network error — check your connection.", "NETWORK_ERROR");
    }
    throw new SensorError(msg || `Server error (${status}).`, "SERVER_ERROR");
  }

  throw new SensorError(
    err instanceof Error ? err.message : "Unknown error.",
    "UNKNOWN",
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared request helper — builds auth headers and validates preconditions */
/* ────────────────────────────────────────────────────────────────────────── */

function buildHeaders() {
  const token = getToken();
  if (!token) throw new SensorError("Not logged in.", "NOT_AUTHENTICATED");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const sensorService = {
  /**
   * Fetch the live sensor list + current state for a store.
   * Proxied through /api/sensors/:storeId → sensors.pnefoods.com
   */
  async getSensors(storeId: string, unit?: "c" | "f", signal?: AbortSignal): Promise<SensorsResponse> {
    if (!storeId) throw new SensorError("No store selected.", "NO_STORE");
    try {
      const { data } = await axios.get<SensorsResponse>(
        `/api/sensors/${encodeURIComponent(storeId)}`,
        { params: { unit }, headers: buildHeaders(), timeout: 15_000, signal },
      );
      return data;
    } catch (err) {
      throw mapAxiosError(err);
    }
  },

  /**
   * Fetch aggregated reports (daily / weekly / monthly) for a store.
   * Includes overall summary, hourly time-series, and per-device breakdown.
   */
  async getReports(
    storeId: string,
    period: ReportPeriod = "daily",
    unit?: "c" | "f",
    signal?: AbortSignal,
  ): Promise<ReportsResponse> {
    if (!storeId) throw new SensorError("No store selected.", "NO_STORE");
    try {
      const { data } = await axios.get<ReportsResponse>(
        `/api/sensors/${encodeURIComponent(storeId)}/reports`,
        { params: { period, unit }, headers: buildHeaders(), timeout: 15_000, signal },
      );
      return data;
    } catch (err) {
      throw mapAxiosError(err);
    }
  },

  /**
   * Fetch paginated reading history for a store.
   * Supports date range, per_page, and device_type filtering.
   */
  async getHistory(
    storeId: string,
    params: HistoryQueryParams = {},
    unit?: "c" | "f",
    signal?: AbortSignal,
  ): Promise<HistoryResponse> {
    if (!storeId) throw new SensorError("No store selected.", "NO_STORE");
    try {
      const { data } = await axios.get<HistoryResponse>(
        `/api/sensors/${encodeURIComponent(storeId)}/history`,
        { params: { ...params, unit }, headers: buildHeaders(), timeout: 15_000, signal },
      );
      return data;
    } catch (err) {
      throw mapAxiosError(err);
    }
  },

  /**
   * Fetch alert/alarm records for a date range.
   */
  async getAlerts(
    storeId: string,
    params: AlertsQueryParams = {},
    unit?: "c" | "f",
    signal?: AbortSignal,
  ): Promise<AlertsResponse> {
    if (!storeId) throw new SensorError("No store selected.", "NO_STORE");
    try {
      const { data } = await axios.get<AlertsResponse>(
        `/api/sensors/${encodeURIComponent(storeId)}/alerts`,
        { params: { ...params, unit }, headers: buildHeaders(), timeout: 15_000, signal },
      );
      return data;
    } catch (err) {
      throw mapAxiosError(err);
    }
  },
};
