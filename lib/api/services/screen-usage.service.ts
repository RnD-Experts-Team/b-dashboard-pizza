import axios from "axios";
import type { UsageSegmentReport, UsageSegmentsResponse } from "@/lib/screen-usage/types";

/* Reads the Zustand-persisted token, same as screen-project.service.ts */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/** Statuses retrying can't fix — the recorder drops those segments instead of resending them forever. */
const PERMANENT_REJECTIONS = new Set([400, 403, 404, 413, 422]);

export const screenUsageService = {
  /**
   * Report usage segments of the logged-in manager.
   * Proxied through POST /api/screen-project/{storeId}/usage/segments
   *
   * Plain fetch (not axios) so it can use `keepalive` while the page unloads —
   * sendBeacon can't carry the Authorization header. Resolves when the
   * segments are recorded or permanently rejected; rejects when worth retrying.
   */
  async reportSegments(storeId: string, segments: UsageSegmentReport[], keepalive = false): Promise<void> {
    const res = await fetch(`/api/screen-project/${encodeURIComponent(storeId)}/usage/segments`, {
      method: "POST",
      headers: { ...buildHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ segments }),
      keepalive,
    });
    if (res.ok || PERMANENT_REJECTIONS.has(res.status)) return;
    throw new Error(`Usage report failed (${res.status})`);
  },

  /**
   * Raw usage segments overlapping [from, to] plus the store's stations.
   * Proxied through GET /api/screen-project/{storeId}/usage/segments
   */
  async getSegments(
    storeId: string,
    from: Date,
    to: Date,
    signal?: AbortSignal,
  ): Promise<UsageSegmentsResponse> {
    const { data } = await axios.get<UsageSegmentsResponse>(
      `/api/screen-project/${encodeURIComponent(storeId)}/usage/segments`,
      {
        params: { from: from.toISOString(), to: to.toISOString() },
        headers: buildHeaders(),
        timeout: 30_000,
        signal,
      },
    );
    return data;
  },
};
