import axios from "axios";
import type { UsageReport, UsageReportParams, UsageSegmentReport, UsageTimelineSegment } from "@/lib/screen-usage/types";

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
  async reportSegments(
    storeId: string,
    segments: UsageSegmentReport[],
    /** The browser's clock when the batch was built — the server corrects for a wrong client clock. */
    sentAt: string,
    keepalive = false,
  ): Promise<void> {
    const res = await fetch(`/api/screen-project/${encodeURIComponent(storeId)}/usage/segments`, {
      method: "POST",
      headers: { ...buildHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ sent_at: sentAt, segments }),
      keepalive,
    });
    if (res.ok || PERMANENT_REJECTIONS.has(res.status)) return;
    throw new Error(`Usage report failed (${res.status})`);
  },

  /**
   * The monitoring report across stores, aggregated upstream.
   * Proxied through GET /api/screen-project/usage/report
   */
  async getReport(params: UsageReportParams, signal?: AbortSignal): Promise<UsageReport> {
    const query = new URLSearchParams({ from: params.from, to: params.to, tz: params.tz });
    params.stores.forEach((s) => query.append("stores[]", s));
    params.users?.forEach((u) => query.append("users[]", String(u)));
    const { data } = await axios.get<UsageReport>(`/api/screen-project/usage/report?${query}`, {
      headers: buildHeaders(),
      timeout: 60_000,
      signal,
    });
    return data;
  },

  /**
   * One manager's raw segments over a day — the timeline.
   * Proxied through GET /api/screen-project/usage/timeline
   */
  async getTimeline(
    params: { stores: string[]; userId: number; from: string; to: string },
    signal?: AbortSignal,
  ): Promise<UsageTimelineSegment[]> {
    const query = new URLSearchParams({ user_id: String(params.userId), from: params.from, to: params.to });
    params.stores.forEach((s) => query.append("stores[]", s));
    const { data } = await axios.get<{ segments: UsageTimelineSegment[] }>(`/api/screen-project/usage/timeline?${query}`, {
      headers: buildHeaders(),
      timeout: 30_000,
      signal,
    });
    return data.segments;
  },
};
