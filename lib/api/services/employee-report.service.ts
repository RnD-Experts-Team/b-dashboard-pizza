import axios from "axios";
import type { EmployeeReportResponse } from "@/types/employee-report.types";

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

/** Matches the proxy route's own clamp — distinct from the labor report's 4–12. */
const TREND_WEEKS_MIN = 1;
const TREND_WEEKS_MAX = 12;

export const employeeReportService = {
  /**
   * GET /api/reports/employees/{store}/{date}?trend_weeks=N
   *
   * `date` is any day inside the target business week — the API snaps it to
   * the Tuesday→Monday week containing it, same convention as the labor report.
   */
  async getEmployeeReport(
    store: string,
    date: string,
    trendWeeks: number,
    signal?: AbortSignal,
  ): Promise<EmployeeReportResponse> {
    const { data } = await axios.get<EmployeeReportResponse>(
      `/api/reports/employees/${encodeURIComponent(store)}/${encodeURIComponent(date)}`,
      {
        params: {
          trend_weeks: Math.min(TREND_WEEKS_MAX, Math.max(TREND_WEEKS_MIN, trendWeeks)),
        },
        headers: buildHeaders(),
        timeout: 15_000,
        signal,
      },
    );
    return data;
  },
};
