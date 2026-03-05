import axios, { AxiosError } from "axios";
import type { DsprResponse } from "@/types/dspr.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error types                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type DsprErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class DsprError extends Error {
  constructor(
    message: string,
    public readonly code: DsprErrorCode,
    public readonly status?: number,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "DsprError";
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Read the Bearer token from Zustand's persisted auth-token key in localStorage.
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("auth-token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      // console.warn("[DSPR] Failed to read auth token from localStorage:", e);
    }
    return null;
  }
}

/**
 * Read the selected store id from Zustand's persisted selected-store-storage key.
 */
function getSelectedStoreId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("selected-store-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Use the human-readable storeId (e.g. "03795-00021"), not the numeric id
    return parsed?.state?.selectedStore?.storeId ?? parsed?.state?.selectedStore?.id ?? null;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[DSPR] Failed to read selected store from localStorage:", e);
    }
    return null;
  }
}

/** Get yesterday's date string (YYYY-MM-DD) using local timezone */
function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse the structured error response from the API route.
 */
function parseApiError(err: AxiosError): DsprError {
  const status = err.response?.status;
  const body = err.response?.data as
    | { success?: boolean; error?: { code?: string; message?: string; retryAfter?: number } }
    | undefined;

  const serverMessage = body?.error?.message;
  const serverCode = body?.error?.code;

  // Timeout
  if (err.code === "ECONNABORTED" || status === 504) {
    return new DsprError(
      serverMessage || "Request timed out. Please try again.",
      "TIMEOUT",
      status,
      true
    );
  }

  // Network error (no response at all)
  if (!err.response) {
    return new DsprError(
      "Unable to connect to the server. Check your internet connection.",
      "NETWORK_ERROR",
      undefined,
      true
    );
  }

  switch (status) {
    case 401:
      return new DsprError(
        serverMessage || "The DSPR report service requires a dedicated API token. Please contact your administrator.",
        "UNAUTHORIZED",
        401,
        true // retryable — admin may configure the token while user waits
      );

    case 403:
      return new DsprError(
        serverMessage || "You do not have permission to view this report.",
        "FORBIDDEN",
        403,
        false
      );

    case 404:
      return new DsprError(
        serverMessage || "No report data found for the selected store and date.",
        "NOT_FOUND",
        404,
        false
      );

    case 429: {
      const retryAfter =
        body?.error?.retryAfter ??
        (Number(err.response?.headers?.["retry-after"]) ||
        undefined);
      return new DsprError(
        serverMessage || "Too many requests. Please wait before trying again.",
        "RATE_LIMITED",
        429,
        true,
        retryAfter
      );
    }

    case 502:
    case 503:
      return new DsprError(
        serverMessage || "The report server is temporarily unavailable. Please try again.",
        "SERVER_ERROR",
        status,
        true
      );

    default:
      return new DsprError(
        serverMessage || `An unexpected error occurred (${status}).`,
        serverCode === "UPSTREAM_ERROR" ? "SERVER_ERROR" : "UNKNOWN",
        status,
        status !== undefined && status >= 500
      );
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Request timeout (client-side)                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const CLIENT_TIMEOUT_MS = 30_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  DSPR Service                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * DSPR Service — fetches Daily Store Performance Report.
 * Routes through the local /api/dspr/{storeId}/{date} proxy.
 * Returns structured DsprError on failure for rich UI error handling.
 */
export const dsprService = {
  /**
   * Fetch DSPR data for a given store and date.
   * Defaults to the selected store and yesterday.
   *
   * @throws {DsprError} Structured error with code, retryable flag, etc.
   */
  getReport: async (
    storeId?: string,
    date?: string,
    signal?: AbortSignal
  ): Promise<DsprResponse> => {
    const resolvedStore = storeId || getSelectedStoreId();
    const resolvedDate = date || getYesterday();

    // console.log("[DsprService] getReport:", { storeId, date, resolvedStore, resolvedDate });

    if (!resolvedStore) {
      throw new DsprError(
        "No store selected. Please select a store first.",
        "NO_STORE",
        undefined,
        false
      );
    }

    const token = getToken();
    if (!token) {
      throw new DsprError(
        "Not authenticated. Please log in again.",
        "NOT_AUTHENTICATED",
        undefined,
        false
      );
    }

    const url = `/api/dspr/${encodeURIComponent(resolvedStore)}/${encodeURIComponent(resolvedDate)}`;
    // console.log("[DsprService] Fetching URL:", url);

    try {
      const { data } = await axios.get<DsprResponse>(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: CLIENT_TIMEOUT_MS,
        signal,
      });

      // console.log("[DsprService] Response received:", { filtering: data?.filtering, hasDay: !!data?.day, hasSales: !!data?.sales });

      // Basic response shape validation
      if (!data || !data.filtering || !data.sales || !data.day) {
        throw new DsprError(
          "Received an invalid response from the server.",
          "SERVER_ERROR",
          200,
          true
        );
      }

      return data;
    } catch (err) {
      // Already a DsprError (from validation above)
      if (err instanceof DsprError) throw err;

      // Cancelled request — rethrow silently
      if (axios.isCancel(err)) throw err;

      // Axios error — parse into DsprError
      if (err instanceof AxiosError) throw parseApiError(err);

      // Unknown
      throw new DsprError(
        "An unexpected error occurred.",
        "UNKNOWN",
        undefined,
        false
      );
    }
  },
};
