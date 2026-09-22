import axios from "axios";
import type {
  ShirtCancelPayload,
  ShirtDeliverPayload,
  ShirtDeliveryDatePayload,
  ShirtEntryPayload,
  ShirtHistoryResponse,
  ShirtManualCreatePayload,
  ShirtMilestone,
  ShirtMilestoneFilters,
  ShirtMilestonePaginator,
  ShirtOrderPayload,
} from "@/types/shirt-milestone.types";

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
 * `append` for the array filters, `set` for the scalars. Collapsing
 * `statuses[]` / `stores[]` to a single value would silently drop filters —
 * the backend validates both as arrays.
 */
function buildQuery(f: ShirtMilestoneFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  f.statuses?.forEach((s) => p.append("statuses[]", s));
  if (f.source) p.set("source", f.source);
  if (f.employee_id !== undefined) p.set("employee_id", String(f.employee_id));
  if (f.milestone_month !== undefined)
    p.set("milestone_month", String(f.milestone_month));
  if (f.due_from) p.set("due_from", f.due_from);
  if (f.due_to) p.set("due_to", f.due_to);
  f.stores?.forEach((s) => p.append("stores[]", s));
  if (f.page !== undefined) p.set("page", String(f.page));
  if (f.per_page !== undefined) p.set("per_page", String(f.per_page));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Employee Shirt Milestones — the JSON half of the feature.
 *
 * Note the two envelope shapes, which the return types encode so a wrong
 * unwrap is a compile error rather than a runtime `undefined`:
 *   - the two queues return a RAW Laravel paginator at the top level;
 *   - everything else wraps its result in `{ data: … }`.
 */
export const shirtMilestoneService = {
  /* ── Store Manager ─────────────────────────────────────────────────────── */

  /**
   * The store's milestone queue, oldest due date first.
   * GET /api/v1/stores/[storeNumber]/shirt-milestones
   *
   * `storeNumber` is the store NUMBER ("03759-00001"), not the numeric PK —
   * sending an id gives a 404.
   */
  async getStoreQueue(
    storeNumber: string,
    filters: ShirtMilestoneFilters = {},
    signal?: AbortSignal,
  ): Promise<ShirtMilestonePaginator> {
    // No `.data.data` — this endpoint has no envelope.
    const { data } = await axios.get<ShirtMilestonePaginator>(
      `/api/v1/stores/${encodeURIComponent(storeNumber)}/shirt-milestones${buildQuery(filters)}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /** GET /api/v1/stores/[storeNumber]/shirt-milestones/[id] */
  async getStoreMilestone(
    storeNumber: string,
    id: number,
    signal?: AbortSignal,
  ): Promise<ShirtMilestone> {
    const { data } = await axios.get<{ data: ShirtMilestone }>(
      `/api/v1/stores/${encodeURIComponent(storeNumber)}/shirt-milestones/${id}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /**
   * Fill the entry form: pending_entry → submitted.
   * POST /api/v1/stores/[storeNumber]/shirt-milestones/[id]/entry
   *
   * Any `t_shirt_size` sent is also written back to the employee's profile, so
   * the next milestone for them is pre-filled.
   */
  async submitEntry(
    storeNumber: string,
    id: number,
    payload: ShirtEntryPayload,
  ): Promise<ShirtMilestone> {
    const { data } = await axios.post<{ data: ShirtMilestone }>(
      `/api/v1/stores/${encodeURIComponent(storeNumber)}/shirt-milestones/${id}/entry`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * Create and fill a manual milestone in one call — lands directly in
   * `submitted`, returns 201. For giving someone a shirt without waiting for a
   * month to come around; these never collide with the automatic ones.
   * POST /api/v1/stores/[storeNumber]/shirt-milestones
   */
  async createManual(
    storeNumber: string,
    payload: ShirtManualCreatePayload,
  ): Promise<ShirtMilestone> {
    const { data } = await axios.post<{ data: ShirtMilestone }>(
      `/api/v1/stores/${encodeURIComponent(storeNumber)}/shirt-milestones`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /** GET /api/v1/stores/[storeNumber]/employees/[employeeId]/shirts */
  async getEmployeeHistory(
    storeNumber: string,
    employeeId: number,
    signal?: AbortSignal,
  ): Promise<ShirtHistoryResponse> {
    const { data } = await axios.get<{ data: ShirtHistoryResponse }>(
      `/api/v1/stores/${encodeURIComponent(storeNumber)}/employees/${employeeId}/shirts`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /* ── Fulfilment (HQ) ───────────────────────────────────────────────────── */

  /**
   * The cross-store fulfilment queue.
   * GET /api/v1/shirt-milestones
   *
   * 403s until the "Employee Obsession" role is granted on the auth server —
   * the contract does not change when it is switched on.
   */
  async getFulfilmentQueue(
    filters: ShirtMilestoneFilters = {},
    signal?: AbortSignal,
  ): Promise<ShirtMilestonePaginator> {
    // No `.data.data` — raw paginator, same as the store queue.
    const { data } = await axios.get<ShirtMilestonePaginator>(
      `/api/v1/shirt-milestones${buildQuery(filters)}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data;
  },

  /** GET /api/v1/shirt-milestones/[id] */
  async getMilestone(id: number, signal?: AbortSignal): Promise<ShirtMilestone> {
    const { data } = await axios.get<{ data: ShirtMilestone }>(
      `/api/v1/shirt-milestones/${id}`,
      { headers: buildHeaders(), timeout: 15_000, signal },
    );
    return data.data;
  },

  /** submitted → ordered. POST /api/v1/shirt-milestones/[id]/order */
  async order(id: number, payload: ShirtOrderPayload): Promise<ShirtMilestone> {
    const { data } = await axios.post<{ data: ShirtMilestone }>(
      `/api/v1/shirt-milestones/${id}/order`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /**
   * Reschedule. PATCH /api/v1/shirt-milestones/[id]/delivery-date
   * Status stays `ordered`; this is not a transition.
   */
  async updateDeliveryDate(
    id: number,
    payload: ShirtDeliveryDatePayload,
  ): Promise<ShirtMilestone> {
    const { data } = await axios.patch<{ data: ShirtMilestone }>(
      `/api/v1/shirt-milestones/${id}/delivery-date`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /** ordered → delivered. POST /api/v1/shirt-milestones/[id]/deliver */
  async deliver(id: number, payload: ShirtDeliverPayload): Promise<ShirtMilestone> {
    const { data } = await axios.post<{ data: ShirtMilestone }>(
      `/api/v1/shirt-milestones/${id}/deliver`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },

  /** → cancelled, permanent for that month. POST /api/v1/shirt-milestones/[id]/cancel */
  async cancel(id: number, payload: ShirtCancelPayload): Promise<ShirtMilestone> {
    const { data } = await axios.post<{ data: ShirtMilestone }>(
      `/api/v1/shirt-milestones/${id}/cancel`,
      payload,
      { headers: buildHeaders(), timeout: 15_000 },
    );
    return data.data;
  },
};
