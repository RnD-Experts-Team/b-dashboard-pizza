import axios from "axios";
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
  ApiItemCell,
  ItemCell,
  ApiInspectionItem,
  InspectionItem,
  SetCellPayload,
  FinalizePayload,
  PeriodType,
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
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class CleaningError extends Error {
  readonly code: CleaningErrorCode;
  readonly retryable: boolean;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    code: CleaningErrorCode,
    fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "CleaningError";
    this.code = code;
    this.fieldErrors = fieldErrors;
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
      | { errors?: Record<string, string[]>; message?: string }
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

function transformChartCell(raw: ApiChartCell): ChartCell {
  return {
    taskId: raw.task_id,
    name: raw.name,
    weight: raw.weight,
    verdict: raw.verdict ?? null,
    note: raw.note ?? null,
    photos: raw.photos ?? [],
  };
}

/**
 * `item_values[name]` is `{value, note, photos}` on current backends but was a
 * bare value string on older ones — normalize both so a mid-deploy API can't
 * blank (or crash) the grid.
 */
function transformItemCell(raw: ApiItemCell | undefined): ItemCell {
  if (raw == null) return { value: "empty", note: null, photos: [] };
  if (typeof raw === "string") return { value: raw, note: null, photos: [] };
  return {
    value: raw.value ?? "empty",
    note: raw.note ?? null,
    photos: raw.photos ?? [],
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
  };
}

function transformGrid(raw: ApiEvaluationGrid): EvaluationGrid {
  return {
    periodType: raw.period_type,
    periodKey: raw.period_key,
    items: (raw.items ?? []).map((i: ApiInspectionItem) => ({ id: i.id, name: i.name })),
    rows: (raw.rows ?? []).map(transformEvalRow),
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
        headers: authHeaders(),
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

  /* ── Track 2: Inspection items (columns) ── */

  async listInspectionItems(signal?: AbortSignal): Promise<InspectionItem[]> {
    try {
      const res = await axios.get(`/api/cleaning/inspection-items`, {
        headers: authHeaders(),
        timeout: 15_000,
        signal,
      });
      const rows = unwrap<ApiInspectionItem[]>(res.data) ?? [];
      return rows.map((i) => ({ id: i.id, name: i.name }));
    } catch (err) {
      throw toCleaningError(err);
    }
  },

  async addInspectionItem(name: string): Promise<InspectionItem> {
    try {
      const res = await axios.post(
        `/api/cleaning/inspection-items`,
        { name },
        { headers: { ...authHeaders(), "Content-Type": "application/json" }, timeout: 15_000 }
      );
      const item = unwrap<ApiInspectionItem>(res.data);
      return { id: item.id, name: item.name };
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
