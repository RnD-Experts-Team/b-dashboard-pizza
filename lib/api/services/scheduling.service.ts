import axios from "axios";
import type { ScheduleMode } from "@/types/scheduling.types";

/**
 * Client for the scheduling proxy at `/api/scheduling/...`.
 *
 * Follows the house pattern set by `labor.service.ts`: bare `axios` against a
 * same-origin path, with the bearer token read out of the Zustand-persisted
 * `localStorage["auth-token"]`. It deliberately does NOT use `axiosClient`,
 * whose `baseURL` points at the external auth API rather than our own routes.
 *
 * One consequence worth knowing: because these calls bypass `axiosClient`, they
 * also bypass its 401 interceptor, so a expired token will NOT auto-logout from
 * here. `handleUnauthorized` below covers that gap explicitly.
 *
 * Responses are returned as the API shaped them. Errors are left to throw so the
 * caller can run them through `parseSchedulingError`, which preserves the
 * server's own message and `error.code`.
 */

const TIMEOUT_MS = 30_000;

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

function buildHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error("Not logged in.");
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/**
 * Headers for a multipart upload.
 *
 * Content-Type is deliberately omitted: the browser must set it so it can add
 * the multipart boundary. Setting it by hand produces a request the server
 * cannot parse.
 */
function buildUploadHeaders(): Record<string, string> {
  return buildHeaders();
}

const base = (storeId: string) =>
  `/api/scheduling/stores/${encodeURIComponent(storeId)}`;

/** Envelope for a single resource or the week payload. */
interface DataEnvelope<T> {
  data: T;
}

/**
 * Laravel paginator, returned RAW by the template and published-schedule list
 * endpoints — with no outer `data` wrapper, unlike everything else. Branch on
 * this rather than assuming a consistent envelope.
 */
export interface LaravelPaginator<T> {
  current_page: number;
  data: T[];
  last_page: number;
  per_page: number;
  total: number;
}

export interface GetWeekParams {
  week_start?: string;
  mode?: ScheduleMode;
  department?: string;
  search?: string;
}

export const schedulingService = {
  /**
   * Proves the whole auth chain end to end. Run this first — if it fails, the
   * cause is auth configuration, not the feature wiring.
   */
  async health(signal?: AbortSignal): Promise<unknown> {
    const { data } = await axios.get("/api/scheduling/health", {
      headers: buildHeaders(),
      timeout: TIMEOUT_MS,
      signal,
    });
    return data;
  },

  /**
   * The bootstrap call: roster, shifts, actuals, availability, time off,
   * conflicts, stats, store settings and the published record in one trip.
   *
   * `week_start` may be ANY day inside the target week — the server snaps it to
   * the store's configured week start and reports the true start in
   * `week.start`. Send the date the user is looking at and render from the
   * response.
   */
  async getWeek(
    storeId: string,
    params: GetWeekParams,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const { data } = await axios.get<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/week`,
      { params, headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data.data;
  },

  async getDepartments(storeId: string, signal?: AbortSignal): Promise<unknown> {
    const { data } = await axios.get<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/departments`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data.data;
  },

  /* ── Shifts ──────────────────────────────────────────────────────────────
   * Updates are POST, not PUT/PATCH — house convention across these services;
   * PUT will not route. Update and delete address the SHIFT id, never the
   * assignment id that the card carries as `id`.
   */

  async createShift(storeId: string, payload: Record<string, unknown>) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/shifts`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  async updateShift(
    storeId: string,
    shiftId: string,
    payload: Record<string, unknown>,
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/shifts/${encodeURIComponent(shiftId)}`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** `confirm` is required when the shift belongs to a published week. */
  async deleteShift(storeId: string, shiftId: string, confirm = false) {
    await axios.delete(`${base(storeId)}/shifts/${encodeURIComponent(shiftId)}`, {
      params: confirm ? { confirm: true } : undefined,
      headers: buildHeaders(),
      timeout: TIMEOUT_MS,
    });
  },

  /* ── Employee sync ───────────────────────────────────────────────────────
   * Polled after a 409 EMPLOYEE_NOT_SYNCED, which is a WAIT and not a failure:
   * nothing was written and the sync has already been requested.
   */

  async getEmployeeSyncStatus(
    storeId: string,
    employeeId: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const { data } = await axios.get<DataEnvelope<unknown>>(
      `${base(storeId)}/employees/${encodeURIComponent(employeeId)}/sync-status`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data.data;
  },

  /** 200 if already linked, 202 if a sync was requested. Repeat calls dedupe. */
  async requestEmployeeSync(storeId: string, employeeId: string) {
    const { data } = await axios.post(
      `${base(storeId)}/employees/${encodeURIComponent(employeeId)}/humanity-sync`,
      {},
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data;
  },

  /* ── Actual shifts ───────────────────────────────────────────────────────
   * Local to OperationsPizza and never pushed to Humanity: worked time lives in
   * the payroll system, shifts live in Humanity, and these record the gap.
   *
   * `status` is DERIVED server-side from the times and is never sent.
   */

  /**
   * Record or amend what was actually worked.
   *
   * Passing `shift_assignment_id` AMENDS the existing actual for that assignment
   * rather than stacking a duplicate, so this is safe to call twice. Omit it for
   * ad-hoc coverage, which comes back with `status: "added"`.
   */
  async saveActualShift(storeId: string, payload: Record<string, unknown>) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/actual-shifts`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** Edit an actual whose id we already hold. */
  async updateActualShift(
    storeId: string,
    actualId: string,
    payload: Record<string, unknown>,
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/actual-shifts/${encodeURIComponent(actualId)}`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  async markActualAbsent(storeId: string, actualId: string, note?: string) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/actual-shifts/${encodeURIComponent(actualId)}/absent`,
      note ? { note } : {},
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  async deleteActualShift(storeId: string, actualId: string) {
    await axios.delete(
      `${base(storeId)}/actual-shifts/${encodeURIComponent(actualId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
  },

  /** One-click "worked exactly as planned", against the ASSIGNMENT id. */
  async confirmActual(storeId: string, assignmentId: string) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/shift-assignments/${encodeURIComponent(assignmentId)}/confirm-actual`,
      {},
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /* ── Templates ───────────────────────────────────────────────────────────
   * Creating one NAMES A WEEK and lets the server snapshot it; the client does
   * not send shifts. The snapshot is then guaranteed consistent with what was
   * actually saved.
   */

  /** Raw paginator — no `data` wrapper. See `LaravelPaginator`. */
  async listTemplates(
    storeId: string,
    params: { page?: number; per_page?: number } = {},
    signal?: AbortSignal,
  ): Promise<LaravelPaginator<unknown>> {
    const { data } = await axios.get<LaravelPaginator<unknown>>(
      `${base(storeId)}/schedule-templates`,
      { params, headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data;
  },

  async createTemplate(
    storeId: string,
    payload: { name: string; description?: string; week_start: string },
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule-templates`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** Includes the week-relative shifts, which the list endpoint omits. */
  async getTemplate(storeId: string, templateId: string, signal?: AbortSignal) {
    const { data } = await axios.get<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule-templates/${encodeURIComponent(templateId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data.data;
  },

  async deleteTemplate(storeId: string, templateId: string) {
    await axios.delete(
      `${base(storeId)}/schedule-templates/${encodeURIComponent(templateId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
  },

  /* ── Bulk triggers ───────────────────────────────────────────────────────
   * Each returns 202 with a batch id and must be polled via `pollBulk`.
   * `mode`: "merge" adds alongside what is there, "replace" wipes the target
   * week first and sequences deletes before creates.
   */

  async applyTemplate(
    storeId: string,
    payload: { template_id: string; week_start: string; mode?: "merge" | "replace" },
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/apply-template`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /**
   * Create many shifts in one request.
   *
   * The one-hit alternative to looping `POST /shifts`, for when the UI submits a
   * whole week at once — especially over a flaky connection, where N sequential
   * requests each get their own chance to fail partway.
   *
   * Items use `day_index` RELATIVE to `week_start`, not absolute dates, which is
   * exactly the `dayIndex` the grid already carries. Max 500 per request.
   *
   * Not currently called: this UI creates shifts one at a time from the grid, so
   * there is no draft-then-submit flow to batch. Kept because it is the correct
   * endpoint the moment one exists.
   */
  async bulkCreateShifts(
    storeId: string,
    payload: {
      week_start: string;
      mode?: "merge" | "replace";
      shifts: Array<Record<string, unknown>>;
    },
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/create-shifts`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  async copyWeek(
    storeId: string,
    payload: {
      source_week_start: string;
      target_week_start: string;
      mode?: "merge" | "replace";
    },
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/copy-week`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** `confirm` is mandatory — this deletes shifts employees may be working from. */
  async clearWeek(storeId: string, weekStart: string) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/clear-week`,
      { week_start: weekStart, confirm: true },
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /* ── Availability & time off ─────────────────────────────────────────────── */

  /**
   * `day_of_week` is on the canonical 0=Sun..6=Sat basis — NOT the grid's
   * `day_index`. Convert with `dayIndexToDayOfWeek` at the call site.
   */
  async createAvailabilityOverride(
    storeId: string,
    payload: Record<string, unknown>,
  ) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/availability-overrides`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** Only `source: "override"` rows can be removed; profile rows are rejected. */
  async deleteAvailabilityOverride(storeId: string, overrideId: string) {
    await axios.delete(
      `${base(storeId)}/availability-overrides/${encodeURIComponent(overrideId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
  },

  async createTimeOff(storeId: string, payload: Record<string, unknown>) {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/time-off`,
      payload,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** Uses the underlying `timeOffId`, not the synthetic per-day id. */
  async deleteTimeOff(storeId: string, timeOffId: string) {
    await axios.delete(
      `${base(storeId)}/time-off/${encodeURIComponent(timeOffId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
  },

  /* ── Publishing ──────────────────────────────────────────────────────────── */

  /**
   * Publish a week with an optional screenshot.
   *
   * Takes a real `Blob` and lets the browser set the multipart boundary. A
   * `toDataURL` string would be base64 in a JSON body — 1-3 MB of it for a
   * typical grid.
   */
  async publishWeek(storeId: string, weekStart: string, screenshot?: Blob) {
    const form = new FormData();
    form.append("week_start", weekStart);
    if (screenshot) {
      form.append("screenshot", screenshot, `schedule-${weekStart}.png`);
    }
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/published-schedules`,
      form,
      { headers: buildUploadHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },

  /** Raw paginator — no `data` wrapper. See `LaravelPaginator`. */
  async listPublished(
    storeId: string,
    params: { page?: number; per_page?: number } = {},
    signal?: AbortSignal,
  ): Promise<LaravelPaginator<unknown>> {
    const { data } = await axios.get<LaravelPaginator<unknown>>(
      `${base(storeId)}/published-schedules`,
      { params, headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data;
  },

  async deletePublished(storeId: string, publishedId: string) {
    await axios.delete(
      `${base(storeId)}/published-schedules/${encodeURIComponent(publishedId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
  },

  /* ── Bulk operations ─────────────────────────────────────────────────────
   * All return 202 with a batch id and must be polled. There is no rollback.
   */

  async pollBulk(
    storeId: string,
    batchId: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const { data } = await axios.get<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/${encodeURIComponent(batchId)}`,
      { headers: buildHeaders(), timeout: TIMEOUT_MS, signal },
    );
    return data.data;
  },

  /** Re-queues ONLY the failed items; successful ones are left alone. */
  async retryFailedBulk(storeId: string, batchId: string): Promise<unknown> {
    const { data } = await axios.post<DataEnvelope<unknown>>(
      `${base(storeId)}/schedule/bulk/${encodeURIComponent(batchId)}/retry-failed`,
      {},
      { headers: buildHeaders(), timeout: TIMEOUT_MS },
    );
    return data.data;
  },
};

/**
 * Explicit 401 handling.
 *
 * These services use bare `axios`, so `axiosClient`'s response interceptor —
 * which clears storage and redirects on 401 — never runs for them. Call this
 * from the hooks' error paths so an expired token still ends the session
 * instead of surfacing as a confusing scheduling error.
 */
export function handleUnauthorized(status: number | null): boolean {
  if (status !== 401 || typeof window === "undefined") return false;
  localStorage.removeItem("auth-token");
  localStorage.removeItem("auth-user");
  if (!window.location.pathname.includes("/auth")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const locale = ["en", "ar"].includes(parts[0]) ? parts[0] : "en";
    window.location.href = `/${locale}/auth/login`;
  }
  return true;
}
