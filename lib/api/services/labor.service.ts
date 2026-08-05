import axios from "axios";
import type { LaborDashboardResponse } from "@/types/labor.types";

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/*  Duplicated per-service by convention — see employee.service.ts.    */
/* ------------------------------------------------------------------ */

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

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/** Matches the proxy route's own clamp so the two can't disagree. */
const TREND_WEEKS_MIN = 4;
const TREND_WEEKS_MAX = 12;

export const laborService = {
  /**
   * GET /api/hiring-management/{storeId}/labor/{date}?trend_weeks=N
   *
   * `storeId` must be the store_number (e.g. "03795-00021"), not the numeric
   * internal id. `date` is any day inside the target business week — the API
   * snaps it to the Tuesday→Monday week containing it.
   *
   * Uses bare axios against a same-origin path on purpose: axiosClient's
   * baseURL points at the external auth API.
   */
  async getLaborDashboard(
    storeId: string,
    date: string,
    trendWeeks: number,
    signal?: AbortSignal,
  ): Promise<LaborDashboardResponse> {
    const { data } = await axios.get<LaborDashboardResponse>(
      `/api/hiring-management/${encodeURIComponent(storeId)}/labor/${encodeURIComponent(date)}`,
      {
        params: {
          trend_weeks: Math.min(
            TREND_WEEKS_MAX,
            Math.max(TREND_WEEKS_MIN, trendWeeks),
          ),
        },
        headers: buildHeaders(),
        timeout: 30_000,
        signal,
      },
    );
    return data;
  },
};
