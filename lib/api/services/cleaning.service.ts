import axios from "axios";
import { useAuthStore } from "@/lib/auth/auth.store";
import type {
  ApiDueResponse,
  DueResponse,
  ApiDueItem,
  DueItem,
  ApiDueRangeResponse,
  DueRangeResponse,
  ApiHistoryEntry,
  HistoryEntry,
  ApiCleaningTask,
  CleaningTask,
  CreateTaskPayload,
  UpdateTaskPayload,
  CompleteTaskPayload,
  ApiEvaluationGrid,
  EvaluationGrid,
  ApiEvalRow,
  EvalRow,
  ApiChartCell,
  ChartCell,
  ApiAllocatedFrom,
  AllocatedFrom,
  ApiItemCell,
  ItemCell,
  ApiAbsentTask,
  AbsentTask,
  ApiAllocation,
  Allocation,
  ApiMissingCell,
  MissingCell,
  ApiPeriodInfo,
  PeriodInfo,
  ApiInspectionItem,
  InspectionItem,
  SetCellPayload,
  FinalizePayload,
  ReopenPayload,
  PeriodType,
  ApiPeriodsResponse,
  PeriodsResponse,
  ApiPeriodOption,
  PeriodOption,
  UpdateInspectionItemPayload,
  GetAllocationsQuery,
  SetAllocationPayload,
  DeleteAllocationPayload,
  ApiCleaningSettings,
  CleaningSettings,
  UpdateSettingsPayload,
} from "@/types/cleaning.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error handling                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type CleaningErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_SYNCED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class CleaningError extends Error {
  readonly code: CleaningErrorCode;
  readonly retryable: boolean;
  readonly fieldErrors?: Record<string, string[]>;
  /** Present on a 409 from POST /evaluations/finalize when cells are still
   *  ungraded — the exact cells, per the API, not just "incomplete". */
  readonly missing?: MissingCell[];

  constructor(
    message: string,
    code: CleaningErrorCode,
    fieldErrors?: Record<string, string[]>,
    missing?: MissingCell[]
  ) {
    super(message);
    this.name = "CleaningError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.missing = missing;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helpers (same convention as qa.service.ts)                           */
/* ────────────────────────────────────────────────────────────────────────── */

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

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) {
    throw new CleaningError(
      "You must be logged in to use the Cleaning Chart.",
      "NOT_AUTHENTICATED"
    );
  }
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

/**
 * The dashboard's currently-selected store as its HUMAN code (e.g.
 * "03795-00001") — read straight from persisted/auth state rather than
 * passed in, so every call site gets it without threading a param through.
 *
 * Same base convention as qa.service.ts's getSelectedStoreId (cleaning talks
 * to the same QA backend, whose store-scoped auth rules resolve the store
 * from the `X-Store-Id` header and expect the human code, not the numeric
 * id) — extended here with an `overviewStores` fallback so it doesn't
 * depend on a store-switcher widget having been used at least once.
 */
function getSelectedStoreCode(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("selected-store-storage");
  if (raw) {
    try {
      const storeId = JSON.parse(raw)?.state?.selectedStore?.storeId;
      if (typeof storeId === "string" && storeId.trim()) return storeId.trim();
    } catch {
      // fall through to the overviewStores fallback below
    }
  }
  // "selected-store-storage" only gets written once a store-switcher widget
  // has actually been used — a store manager who never touches one (common
  // when they only have one store) would otherwise always resolve to null
  // here. Falls back to their own first assigned store from
  // GET /auth/general-overview, loaded at login regardless of widget use.
  const overviewStoreId = useAuthStore.getState().overviewStores?.[0]?.storeId;
  return typeof overviewStoreId === "string" && overviewStoreId.trim()
    ? overviewStoreId.trim()
    : null;
}

/**
 * Auth headers plus the store-scope hint.
 *
 * Endpoints whose URL carries no store (GET /cleaning/evaluations is
 * company-wide by path) rely on this header so the backend can authorize a
 * store_manager against their own store — without it, only the unscoped
 * "cleaning specialist" permission passes and a manager gets a 403.
 */
function storeScopedHeaders(): Record<string, string> {
  const storeCode = getSelectedStoreCode();
  return {
    ...authHeaders(),
    ...(storeCode && { "X-Store-Id": storeCode }),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error normalization                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function toCleaningError(err: unknown): CleaningError {
  if (err instanceof CleaningError) return err;
  if (axios.isCancel(err)) throw err;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as
      | {
          error?: { code?: string; message?: string; details?: Record<string, unknown> };
          message?: string;
        }
      | undefined;
    const serverCode = data?.error?.code;
    const serverMessage = data?.error?.message || data?.message;

    // Extract Laravel-style upstream validation errors, if present.
    const upstream = data?.error?.details?.upstream as
      | { errors?: Record<string, string[]>; message?: string; missing?: MissingCell[] }
      | undefined;
    const fieldErrors = upstream?.errors;

    if (status === 401 || serverCode === "UNAUTHORIZED" || serverCode === "NOT_AUTHENTICATED") {
      const msg = serverMessage || "";
      if (/not synced|sync/i.test(msg)) {
        return new CleaningError(
          "This store or user isn't available yet — please try again shortly.",
          "NOT_SYNCED"
        );
      }
      return new CleaningError(msg || "Authentication failed.", "UNAUTHORIZED");
    }
    if (status === 403 || serverCode === "FORBIDDEN") {
      return new CleaningError(
        serverMessage || "You don't have permission to perform this action.",
        "FORBIDDEN"
      );
    }
    if (status === 404 || serverCode === "NOT_FOUND") {
      return new CleaningError(serverMessage || "Not found.", "NOT_FOUND");
    }
    if (status === 422 || serverCode === "VALIDATION_ERROR") {
      return new CleaningError(
        upstream?.message || serverMessage || "Some fields are invalid.",
        "VALIDATION_ERROR",
        fieldErrors
      );
    }
    if (status === 409) {
      // Two distinct 409s share this status: finalize-with-ungraded-cells
      // (carries `missing[]`) and any write on an already-finalized/locked
      // evaluation (message only). Both surface as CONFLICT; callers that
      // care about the missing-cells case check `.missing`.
      return new CleaningError(
        upstream?.message || serverMessage || "This action can't be completed right now.",
        "CONFLICT",
        undefined,
        upstream?.missing
      );
    }
    if (status === 429 || serverCode === "RATE_LIMITED") {
      return new CleaningError(
        serverMessage || "Too many requests. Please wait and try again.",
        "RATE_LIMITED"
      );
    }
    if (serverCode === "TIMEOUT" || err.code === "ECONNABORTED") {
      return new CleaningError("Request timed out. Please try again.", "TIMEOUT");
    }
    if (!err.response || err.code === "ERR_NETWORK") {
      return new CleaningError(
        "Unable to connect. Please check your internet connection.",
        "NETWORK_ERROR"
      );
    }
    if (status && status >= 500) {
      return new CleaningError(
        serverMessage || "The server encountered an error. Please try again.",
        "SERVER_ERROR"
      );
    }
    return new CleaningError(serverMessage || "Something went wrong.", "UNKNOWN");
  }

  return new CleaningError("An unexpected error occurred.", "UNKNOWN");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transforms                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function toPeriodTuple(p: [string, string] | string[]): [string, string] {
  return [p?.[0] ?? "", p?.[1] ?? ""];
}

function transformDueItem(raw: ApiDueItem): DueItem {
  return {
    taskId: raw.task_id,
    label: raw.label,
    description: raw.description ?? null,
    frequency: raw.frequency,
    weight: raw.weight ?? 0,
    photoRequired: raw.photo_required,
    period: toPeriodTuple(raw.period),
    status: raw.status,
    doneAt: raw.done_at ?? null,
    doneBy: raw.done_by ?? [],
    hasPhoto: raw.has_photo ?? false,
    photos: raw.photos ?? [],
    note: raw.note ?? null,
    completionId: raw.completion_id ?? null,
  };
}

function transformDue(raw: ApiDueResponse): DueResponse {
  return {
    storeId: raw.store_id,
    date: raw.date,
    items: (raw.items ?? []).map(transformDueItem),
    employees: (raw.employees ?? []).map((e) => ({ id: e.id, name: e.name })),
  };
}

function transformDueRange(raw: ApiDueRangeResponse): DueRangeResponse {
  return {
    storeId: raw.store_id,
    from: raw.from,
    to: raw.to,
    days: (raw.days ?? []).map((d) => ({
      date: d.date,
      items: (d.items ?? []).map(transformDueItem),
    })),
  };
}

function transformHistory(raw: ApiHistoryEntry): HistoryEntry {
  return {
    taskId: raw.task_id,
    label: raw.label,
    frequency: raw.frequency,
    period: toPeriodTuple(raw.period),
    status: raw.status,
    doneAt: raw.done_at ?? null,
    doneBy: raw.done_by ?? [],
    hasPhoto: raw.has_photo ?? false,
    photos: raw.photos ?? [],
    note: raw.note ?? null,
  };
}

function transformTask(raw: ApiCleaningTask): CleaningTask {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    weight: raw.weight ?? null,
    frequency: raw.frequency,
    interval: raw.interval ?? null,
    weekDays: raw.week_days ?? null,
    intervalHours: raw.interval_hours ?? null,
    startsAt: raw.starts_at ?? null,
    endsAt: raw.ends_at ?? null,
    dueTime: raw.due_time ?? null,
    dueTime2: raw.due_time_2 ?? null,
    photoRequired: raw.photo_required,
    stores: (raw.stores ?? []).map((s) => ({
      id: s.id,
      name: s.store ?? s.name ?? `Store ${s.id}`,
    })),
  };
}

function transformAllocatedFrom(raw: ApiAllocatedFrom): AllocatedFrom {
  return { taskId: raw.task_id, name: raw.name, amount: raw.amount };
}

function transformChartCell(raw: ApiChartCell): ChartCell {
  return {
    taskId: raw.task_id,
    name: raw.name,
    weight: raw.weight,
    baseWeight: raw.base_weight ?? raw.weight,
    effectiveWeight: raw.effective_weight ?? raw.weight,
    allocatedFrom: (raw.allocated_from ?? []).map(transformAllocatedFrom),
    verdict: raw.verdict ?? null,
    note: raw.note ?? null,
    photos: raw.photos ?? [],
    historical: raw.historical ?? false,
  };
}

/**
 * `item_values[name]` is `{value, weight, note, photos}` on current backends
 * but was a bare value string on older ones — normalize both so a mid-deploy
 * API can't blank (or crash) the grid.
 */
function transformItemCell(raw: ApiItemCell | undefined): ItemCell {
  if (raw == null) return { value: "empty", weight: 1, note: null, photos: [] };
  if (typeof raw === "string") return { value: raw, weight: 1, note: null, photos: [] };
  return {
    value: raw.value ?? "empty",
    weight: raw.weight ?? 1,
    note: raw.note ?? null,
    photos: raw.photos ?? [],
  };
}

function transformAbsentTask(raw: ApiAbsentTask): AbsentTask {
  return {
    taskId: raw.task_id,
    name: raw.name,
    frequency: raw.frequency,
    weight: raw.weight,
    reason: raw.reason,
    allocated: raw.allocated,
    unallocated: raw.unallocated,
  };
}

function transformAllocation(raw: ApiAllocation): Allocation {
  return {
    sourceTaskId: raw.source_task_id,
    targetTaskId: raw.target_task_id,
    amount: raw.amount,
  };
}

function transformMissingCell(raw: ApiMissingCell): MissingCell {
  return { kind: raw.kind, id: raw.id, name: raw.name };
}

function transformPeriodInfo(raw: ApiPeriodInfo): PeriodInfo {
  return {
    key: raw.key,
    year: raw.year,
    week: raw.week,
    period: raw.period,
    weekInPeriod: raw.week_in_period,
    label: raw.label,
    from: raw.from,
    to: raw.to,
  };
}

function transformEvalRow(raw: ApiEvalRow): EvalRow {
  const itemValues: Record<string, ItemCell> = {};
  for (const [name, cell] of Object.entries(raw.item_values ?? {})) {
    itemValues[name] = transformItemCell(cell);
  }
  return {
    storeId: raw.store_id,
    store: raw.store,
    itemValues,
    itemScore: raw.item_score ?? 0,
    chart: {
      daily: (raw.chart?.daily ?? []).map(transformChartCell),
      weekly: (raw.chart?.weekly ?? []).map(transformChartCell),
      monthly: (raw.chart?.monthly ?? []).map(transformChartCell),
      hourly: (raw.chart?.hourly ?? []).map(transformChartCell),
    },
    chartScore: raw.chart_score ?? 0,
    weightLost: raw.weight_lost ?? 0,

    absentTasks: (raw.absent_tasks ?? []).map(transformAbsentTask),
    allocations: (raw.allocations ?? []).map(transformAllocation),

    completionPct: raw.completion_pct ?? 0,
    isComplete: raw.is_complete ?? false,
    gradedCount: raw.graded_count ?? 0,
    requiredCount: raw.required_count ?? 0,
    missing: (raw.missing ?? []).map(transformMissingCell),

    // `final_score` is meaningfully nullable — a store with nothing graded has
    // NO score, not a zero score. Never coerce this to 0.
    finalScore: raw.final_score ?? null,
    commitmentPass: raw.commitment_pass ?? false,
    scoreFormula: raw.score_formula ?? "average",
    scoreShares: raw.score_shares ?? { items: 50, chart: 50 },
    scoreSides: raw.score_sides ?? [],
    itemHasAutoFail: raw.item_has_auto_fail ?? false,
    scoreFrozen: raw.score_frozen ?? false,

    finalizedAt: raw.finalized_at ?? null,
    finalizedBy: raw.finalized_by ?? null,
  };
}

function transformGrid(raw: ApiEvaluationGrid): EvaluationGrid {
  return {
    periodType: raw.period_type,
    periodKey: raw.period_key,
    period: transformPeriodInfo(raw.period),
    items: (raw.items ?? []).map((i: ApiInspectionItem) => ({
      id: i.id,
      name: i.name,
      weight: i.weight ?? 1,
    })),
    rows: (raw.rows ?? []).map(transformEvalRow),
  };
}

function transformPeriodOption(raw: ApiPeriodOption): PeriodOption {
  return {
    key: raw.key,
    label: raw.label,
    period: raw.period,
    weekInPeriod: raw.week_in_period,
    from: raw.from,
    to: raw.to,
  };
}

function transformPeriodsResponse(raw: ApiPeriodsResponse): PeriodsResponse {
  return {
    current: raw.current,
    options: (raw.options ?? []).map(transformPeriodOption),
  };
}

/**
 * Accepts flat `items_share`/`chart_share` OR a nested `shares`/`score_shares`
 * object (the same shape the evaluation row already uses for its own
 * `score_shares`) — whichever the deployment actually returns. Always yields
 * finite numbers that sum to 100, never `NaN`/`undefined` reaching the UI.
 */
function transformSettings(raw: ApiCleaningSettings): CleaningSettings {
  const nested = raw.shares ?? raw.score_shares;
  const rawItems = raw.items_share ?? nested?.items;
  const rawChart = raw.chart_share ?? nested?.chart;
  const itemsShare = Number.isFinite(rawItems)
    ? (rawItems as number)
    : Number.isFinite(rawChart)
      ? 100 - (rawChart as number)
      : 50;
  const chartShare = Number.isFinite(rawChart) ? (rawChart as number) : 100 - itemsShare;
  return {
    scoreFormula: raw.score_formula ?? "average",
    itemsShare,
    chartShare,
    explain: raw.explain ?? {},
  };
}

function unwrap<T>(data: unknown): T {
  // Endpoints return either `{ data: ... }` or a flat object.
  if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
    return (data as { data: T }).data;
  }
  return data as T;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const cleaningService = {
  /* ── Track 1: Due / Complete / History ── */

  async getDue(storeId: number, date: string, signal?: AbortSignal): Promise<DueResponse> {
    try {
      const res = await axios.get<ApiDueResponse>(
        `/api/cleaning/stores/${storeId}/dates/${date}/due`,
        { headers: authHeaders(), timeout: 15_000, signal }
      );
      return transformDue(res.data);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async getDueRange(
    storeId: number,
    from: string,
    to: string,
    signal?: AbortSignal
  ): Promise<DueRangeResponse> {
    try {
      const res = await axios.get<ApiDueRangeResponse>(
        `/api/cleaning/stores/${storeId}/due-range`,
        { params: { from, to }, headers: authHeaders(), timeout: 15_000, signal }
      );
      return transformDueRange(res.data);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async completeTask(
    storeId: number,
    taskId: number,
    payload: CompleteTaskPayload
  ): Promise<void> {
    try {
      const fd = new FormData();
      fd.append("date", payload.date);
      payload.employeeIds.forEach((id) => fd.append("employee_ids[]", String(id)));
      if (payload.note?.trim()) fd.append("note", payload.note.trim());
      (payload.photos ?? []).forEach((file) => fd.append("photos[]", file, file.name));

      // NOTE: do not set Content-Type — the browser adds the multipart boundary.
      await axios.post(
        `/api/cleaning/stores/${storeId}/tasks/${taskId}/complete`,
        fd,
        { headers: authHeaders(), timeout: 120_000 }
      );
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async uncompleteTask(storeId: number, taskId: number, date: string): Promise<void> {
    try {
      await axios.post(
        `/api/cleaning/stores/${storeId}/tasks/${taskId}/uncomplete`,
        { date },
        { headers: authHeaders(), timeout: 15_000 }
      );
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async getHistory(
    storeId: number,
    taskId: number,
    range?: { from?: string; to?: string },
    signal?: AbortSignal
  ): Promise<HistoryEntry[]> {
    try {
      const res = await axios.get(
        `/api/cleaning/stores/${storeId}/tasks/${taskId}/history`,
        { params: range, headers: authHeaders(), timeout: 15_000, signal }
      );
      const rows = unwrap<ApiHistoryEntry[]>(res.data) ?? [];
      return rows.map(transformHistory);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 1: Task definitions ── */

  async listTasks(signal?: AbortSignal): Promise<CleaningTask[]> {
    try {
      const res = await axios.get(`/api/cleaning/tasks`, {
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      const rows = unwrap<ApiCleaningTask[]>(res.data) ?? [];
      return rows.map(transformTask);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async getTask(taskId: number, signal?: AbortSignal): Promise<CleaningTask> {
    try {
      const res = await axios.get(`/api/cleaning/tasks/${taskId}`, {
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      return transformTask(unwrap<ApiCleaningTask>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async createTask(payload: CreateTaskPayload): Promise<CleaningTask> {
    try {
      const res = await axios.post(`/api/cleaning/tasks`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 20_000,
      });
      return transformTask(unwrap<ApiCleaningTask>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** PUT /tasks/{task} — send only the fields that changed. */
  async updateTask(taskId: number, payload: UpdateTaskPayload): Promise<CleaningTask> {
    try {
      const res = await axios.put(`/api/cleaning/tasks/${taskId}`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 20_000,
      });
      return transformTask(unwrap<ApiCleaningTask>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** DELETE /tasks/{task} — soft delete: removed from Due, history/completions kept. */
  async deleteTask(taskId: number): Promise<void> {
    try {
      await axios.delete(`/api/cleaning/tasks/${taskId}`, {
        headers: authHeaders(),
        timeout: 15_000,
      });
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Evaluation grid ── */

  async getEvaluations(
    periodType: PeriodType,
    periodKey: string,
    signal?: AbortSignal
  ): Promise<EvaluationGrid> {
    try {
      const res = await axios.get<ApiEvaluationGrid>(`/api/cleaning/evaluations`, {
        params: { period_type: periodType, period_key: periodKey },
        headers: storeScopedHeaders(),
        timeout: 15_000,
        signal,
      });
      return transformGrid(res.data);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /**
   * Set one evaluation cell.
   *
   * Chart cells stay a plain-JSON quick toggle. Item cells go as multipart so
   * they can carry the grader's note + images — do NOT set Content-Type there,
   * the browser adds the multipart boundary itself.
   */
  async setCell(payload: SetCellPayload): Promise<EvalRow> {
    try {
      if (payload.kind === "item") {
        const fd = new FormData();
        fd.append("store_id", String(payload.store_id));
        fd.append("period_type", payload.period_type);
        fd.append("period_key", payload.period_key);
        fd.append("kind", "item");
        fd.append("inspection_item_id", String(payload.inspection_item_id));
        fd.append("value", payload.value);
        if (payload.note?.trim()) fd.append("note", payload.note.trim());
        (payload.images ?? []).forEach((file) => fd.append("images[]", file, file.name));

        const res = await axios.post(`/api/cleaning/evaluations`, fd, {
          headers: authHeaders(),
          timeout: 120_000,
        });
        return transformEvalRow(unwrap<ApiEvalRow>(res.data));
      }

      const res = await axios.post(`/api/cleaning/evaluations`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 15_000,
      });
      return transformEvalRow(unwrap<ApiEvalRow>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** Throws a CONFLICT CleaningError with `.missing` populated when the
   *  evaluation still has ungraded cells (409) — see the guide's §7/§13. */
  async finalizeStore(payload: FinalizePayload): Promise<void> {
    try {
      await axios.post(`/api/cleaning/evaluations/finalize`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 20_000,
      });
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** Gated by the "cleaning specialist" permission (403 otherwise) — not
   *  Super Admin only, confirmed against the live permission registry.
   *  Clears the finalize lock and discards the frozen scores, returning the
   *  evaluation to live computation. */
  async reopenStore(payload: ReopenPayload): Promise<void> {
    try {
      await axios.post(`/api/cleaning/evaluations/reopen`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 20_000,
      });
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Periods (accounting calendar) ── */

  /**
   * The only legitimate source of period keys — never generate one locally
   * (see the migration guide §4: local ISO-week keys silently diverge from
   * the accounting calendar on 2026-12-29).
   *
   * Store-scoped headers, same as `getEvaluations` — this URL carries no
   * store, so a store_manager whose "cleaning specialist" permission is
   * granted at the store level (not globally) 403s without `X-Store-Id` to
   * resolve which store to authorize them against (confirmed live: a store
   * manager on the My Store tab got 403 here with plain auth headers).
   */
  async getPeriods(
    type: PeriodType,
    around: string,
    span = 4,
    signal?: AbortSignal
  ): Promise<PeriodsResponse> {
    try {
      const res = await axios.get<ApiPeriodsResponse>(`/api/cleaning/periods`, {
        params: { type, around, span },
        headers: storeScopedHeaders(),
        timeout: 15_000,
        signal,
      });
      return transformPeriodsResponse(res.data);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Inspection items (columns) ── */

  async listInspectionItems(signal?: AbortSignal): Promise<InspectionItem[]> {
    try {
      const res = await axios.get(`/api/cleaning/inspection-items`, {
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      const rows = unwrap<ApiInspectionItem[]>(res.data) ?? [];
      return rows.map((i) => ({ id: i.id, name: i.name, weight: i.weight ?? 1 }));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** `weight` defaults to 1 server-side when omitted — set it up front here,
   *  or change it later per-item from the Evaluation grid's weight editor. */
  async addInspectionItem(name: string, weight?: number): Promise<InspectionItem> {
    try {
      const res = await axios.post(
        `/api/cleaning/inspection-items`,
        weight != null ? { name, weight } : { name },
        { headers: { ...authHeaders(), "Content-Type": "application/json" }, timeout: 15_000 }
      );
      const item = unwrap<ApiInspectionItem>(res.data);
      return { id: item.id, name: item.name, weight: item.weight ?? 1 };
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** PUT /inspection-items/{id} — the item keeps every already-graded cell;
   *  weights are snapshotted per cell, so this never re-scores past grades. */
  async updateInspectionItem(
    id: number,
    payload: UpdateInspectionItemPayload
  ): Promise<InspectionItem> {
    try {
      const res = await axios.put(`/api/cleaning/inspection-items/${id}`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 15_000,
      });
      const item = unwrap<ApiInspectionItem>(res.data);
      return { id: item.id, name: item.name, weight: item.weight ?? 1 };
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async deleteInspectionItem(id: number): Promise<void> {
    try {
      await axios.delete(`/api/cleaning/inspection-items/${id}`, {
        headers: authHeaders(),
        timeout: 15_000,
      });
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Weight allocation ── */

  async getAllocations(
    query: GetAllocationsQuery,
    signal?: AbortSignal
  ): Promise<Allocation[]> {
    try {
      const res = await axios.get(`/api/cleaning/evaluations/allocations`, {
        params: {
          store_id: query.store_id,
          period_type: query.period_type,
          period_key: query.period_key,
        },
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      const rows = unwrap<ApiAllocation[]>(res.data) ?? [];
      return rows.map(transformAllocation);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** Replaces the ENTIRE split for one `source_task_id` in a single
   *  transaction — amounts must sum to the source task's weight exactly. */
  async setAllocation(payload: SetAllocationPayload): Promise<void> {
    try {
      await axios.post(
        `/api/cleaning/evaluations/allocations`,
        {
          store_id: payload.store_id,
          period_type: payload.period_type,
          period_key: payload.period_key,
          source_task_id: payload.source_task_id,
          // The upstream field is `allocations`, not `amounts` — confirmed
          // against a live 422 ("The allocations field is required.").
          allocations: payload.amounts.map((a) => ({
            target_task_id: a.target_task_id,
            amount: a.amount,
          })),
        },
        { headers: { ...authHeaders(), "Content-Type": "application/json" }, timeout: 20_000 }
      );
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async deleteAllocation(payload: DeleteAllocationPayload): Promise<void> {
    try {
      await axios.delete(`/api/cleaning/evaluations/allocations`, {
        params: {
          store_id: payload.store_id,
          period_type: payload.period_type,
          period_key: payload.period_key,
          source_task_id: payload.source_task_id,
        },
        headers: authHeaders(),
        timeout: 15_000,
      });
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Scoring settings (gated by the "cleaning specialist"
     permission, confirmed against the live registry — not Super Admin
     only) ── */

  async getSettings(signal?: AbortSignal): Promise<CleaningSettings> {
    try {
      const res = await axios.get(`/api/cleaning/settings`, {
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      return transformSettings(unwrap<ApiCleaningSettings>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** Gated by the "cleaning specialist" permission — not Super Admin only.
   *  `items_share + chart_share` must equal 100 exactly (422 otherwise) —
   *  the caller should enforce this before submitting. */
  async updateSettings(payload: UpdateSettingsPayload): Promise<CleaningSettings> {
    try {
      const res = await axios.put(`/api/cleaning/settings`, payload, {
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        timeout: 15_000,
      });
      return transformSettings(unwrap<ApiCleaningSettings>(res.data));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /* ── Track 2: Reports ── */

  async getReportData(
    periodType: PeriodType,
    periodKey: string,
    signal?: AbortSignal
  ): Promise<EvaluationGrid> {
    try {
      const res = await axios.get<ApiEvaluationGrid>(`/api/cleaning/reports/data`, {
        params: { period_type: periodType, period_key: periodKey },
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      return transformGrid(res.data);
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  /** Download the CSV report as a Blob (client triggers the save). */
  async downloadCsv(periodType: PeriodType, periodKey: string): Promise<Blob> {
    try {
      const res = await axios.get(`/api/cleaning/reports/csv`, {
        params: { period_type: periodType, period_key: periodKey },
        headers: authHeaders(),
        responseType: "blob",
        timeout: 60_000,
      });
      return res.data as Blob;
    } catch (err) {
      throw toCleaningError(err);
    }
  },
};

export type CleaningService = typeof cleaningService;
