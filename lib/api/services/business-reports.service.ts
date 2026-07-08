import axios from "axios";
import type {
  BusinessReportsParams,
  MultiDashboardResponse,
  V1ReportsResponse,
  WbrBulkResponse,
  StoreSelection,
} from "@/types/business-reports.types";

/** Heavy-page client timeout (matches the proxy routes' default). */
const CLIENT_TIMEOUT_MS = 60_000;

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

/**
 * Build a query string for the GET endpoints.
 * - "all" → `stores[]=all` (when allAsArray) or `stores=all` (otherwise)
 * - list  → repeated `stores[]=<id>`
 */
function buildQuery(
  params: BusinessReportsParams,
  allAsArray: boolean,
): string {
  const qs = new URLSearchParams();
  qs.set("start_date", params.startDate);
  qs.set("end_date", params.endDate);

  const stores: StoreSelection = params.stores;
  if (stores === "all") {
    if (allAsArray) qs.append("stores[]", "all");
    else qs.set("stores", "all");
  } else {
    for (const id of stores) qs.append("stores[]", id);
  }
  return qs.toString();
}

export const businessReportsService = {
  /** POST /api/reports/multi-dashboard — sales & operations rollup. */
  async getMultiDashboard(
    params: BusinessReportsParams,
    signal?: AbortSignal,
  ): Promise<MultiDashboardResponse> {
    const { data } = await axios.post<MultiDashboardResponse>(
      "/api/reports/multi-dashboard",
      {
        start_date: params.startDate,
        end_date: params.endDate,
        stores: params.stores,
      },
      { headers: buildHeaders(), timeout: CLIENT_TIMEOUT_MS, signal },
    );
    return data;
  },

  /** GET /api/reports/v1 — labor & employees. */
  async getV1Reports(
    params: BusinessReportsParams,
    signal?: AbortSignal,
  ): Promise<V1ReportsResponse> {
    const { data } = await axios.get<V1ReportsResponse>(
      `/api/reports/v1?${buildQuery(params, true)}`,
      { headers: buildHeaders(), timeout: CLIENT_TIMEOUT_MS, signal },
    );
    return data;
  },

  /** GET /api/reports/wbr-bulk — feedback, complaints & money owed. */
  async getWbrBulk(
    params: BusinessReportsParams,
    signal?: AbortSignal,
  ): Promise<WbrBulkResponse> {
    const { data } = await axios.get<WbrBulkResponse>(
      `/api/reports/wbr-bulk?${buildQuery(params, false)}`,
      { headers: buildHeaders(), timeout: CLIENT_TIMEOUT_MS, signal },
    );
    return data;
  },
};
