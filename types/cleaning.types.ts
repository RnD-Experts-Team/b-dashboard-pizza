/* ────────────────────────────────────────────────────────────────────────── */
/*  Cleaning Chart types (AuditApp /api/cleaning/*)                           */
/*                                                                            */
/*  Two tracks:                                                               */
/*   - Track 1 (Tasks/Due): recurring cleaning jobs, computed due/done/overdue */
/*   - Track 2 (Evaluation): Excel-style grid + reports                        */
/*                                                                            */
/*  Convention: `Api*` = raw upstream (snake_case), unprefixed = domain        */
/*  (camelCase). `transform*()` map between them (see cleaning.service.ts).    */
/* ────────────────────────────────────────────────────────────────────────── */

/* ── Enums ─────────────────────────────────────────────────────────────── */

export type CleaningFrequency = "daily" | "weekly" | "monthly" | "hourly";
export type DueStatus = "pending" | "done" | "overdue";
export type ItemValue = "pass" | "fail" | "auto_fail" | "empty";
export type ChartVerdict = "pass" | "fail" | "auto_fail";
export type PeriodType = "week" | "date";

/* ── Track 1: Due / Complete / History ─────────────────────────────────── */

export interface ApiEmployee {
  id: number;
  name: string;
}
export interface CleaningEmployee {
  id: number;
  name: string;
}

export interface ApiDueItem {
  task_id: number;
  label: string;
  description: string | null;
  frequency: CleaningFrequency;
  weight: number;
  photo_required: boolean;
  period: [string, string] | string[];
  status: DueStatus;
  done_at: string | null;
  done_by: string[];
  has_photo: boolean;
  photos: string[];
  note: string | null;
  completion_id: number | null;
}
export interface DueItem {
  taskId: number;
  label: string;
  description: string | null;
  frequency: CleaningFrequency;
  weight: number;
  photoRequired: boolean;
  period: [string, string];
  status: DueStatus;
  doneAt: string | null;
  doneBy: string[];
  hasPhoto: boolean;
  photos: string[];
  note: string | null;
  completionId: number | null;
}

export interface ApiDueResponse {
  store_id: number;
  date: string;
  items: ApiDueItem[];
  employees: ApiEmployee[];
}
export interface DueResponse {
  storeId: number;
  date: string;
  items: DueItem[];
  employees: CleaningEmployee[];
}

export interface ApiDueRangeResponse {
  store_id: number;
  from: string;
  to: string;
  days: { date: string; items: ApiDueItem[] }[];
}
export interface DueRangeResponse {
  storeId: number;
  from: string;
  to: string;
  days: { date: string; items: DueItem[] }[];
}

export interface ApiHistoryEntry {
  task_id?: number;
  label?: string;
  frequency?: CleaningFrequency;
  period: [string, string] | string[];
  status: DueStatus;
  done_at?: string | null;
  done_by?: string[];
  has_photo?: boolean;
  photos?: string[];
  note?: string | null;
}
export interface HistoryEntry {
  taskId?: number;
  label?: string;
  frequency?: CleaningFrequency;
  period: [string, string];
  status: DueStatus;
  doneAt: string | null;
  doneBy: string[];
  hasPhoto: boolean;
  photos: string[];
  note: string | null;
}

export interface CompleteTaskPayload {
  date: string;
  employeeIds: number[];
  note?: string;
  /** Sent as `photos[]` — one or more files (required unless the task is hourly). */
  photos?: File[];
}

/* ── Track 1: Task definitions ─────────────────────────────────────────── */

export interface ApiTaskStore {
  id: number;
  store?: string;
  name?: string;
}
export interface ApiCleaningTask {
  id: number;
  name: string;
  description: string | null;
  weight: number | null;
  frequency: CleaningFrequency;
  interval: number | null;
  week_days: number[] | null;
  interval_hours: number | null;
  starts_at: string | null;
  ends_at: string | null;
  due_time: string | null;
  /** Optional second daily due time. Not yet persisted by the backend — see the
   *  handoff note; reads fall back to null until they add the field. */
  due_time_2?: string | null;
  photo_required: boolean;
  stores?: ApiTaskStore[];
  created_at?: string;
  updated_at?: string;
}
export interface CleaningTask {
  id: number;
  name: string;
  description: string | null;
  weight: number | null;
  frequency: CleaningFrequency;
  interval: number | null;
  weekDays: number[] | null;
  intervalHours: number | null;
  startsAt: string | null;
  endsAt: string | null;
  dueTime: string | null;
  dueTime2: string | null;
  photoRequired: boolean;
  stores: { id: number; name: string }[];
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  weight?: number;
  frequency: CleaningFrequency;
  interval?: number;
  week_days?: number[];
  interval_hours?: number | null;
  starts_at: string;
  ends_at?: string | null;
  due_time?: string | null;
  due_time_2?: string | null;
  store_ids: number[];
}

/** PUT /tasks/{task} — send only the fields that changed. */
export type UpdateTaskPayload = Partial<CreateTaskPayload>;

/* ── Track 2: Evaluation grid ──────────────────────────────────────────── */

export interface ApiInspectionItem {
  id: number;
  name: string;
}
export interface InspectionItem {
  id: number;
  name: string;
}

export interface ApiChartCell {
  task_id: number;
  name: string;
  weight: number;
  verdict: ChartVerdict | null;
  note?: string | null;
  photos?: string[];
}
export interface ChartCell {
  taskId: number;
  name: string;
  weight: number;
  verdict: ChartVerdict | null;
  note: string | null;
  /** Relative `/storage/…` URLs — run through `resolvePhotoUrl` before rendering. */
  photos: string[];
}

/** One graded inspection-item cell. */
export interface ItemCell {
  value: ItemValue;
  note: string | null;
  /** Relative `/storage/…` URLs — run through `resolvePhotoUrl` before rendering. */
  photos: string[];
}

/** The API returns `{value, note, photos}` per item; older deploys returned a
 *  bare value string, which `transformEvalRow` still normalizes. */
export type ApiItemCell = ItemValue | { value: ItemValue; note?: string | null; photos?: string[] };

export interface ApiEvalRow {
  store_id: number;
  store: string;
  item_values: Record<string, ApiItemCell>;
  item_score: number;
  chart: {
    daily: ApiChartCell[];
    weekly: ApiChartCell[];
    monthly: ApiChartCell[];
    hourly: ApiChartCell[];
  };
  chart_score: number;
  weight_lost: number;
}
export interface EvalRow {
  storeId: number;
  store: string;
  itemValues: Record<string, ItemCell>;
  itemScore: number;
  chart: {
    daily: ChartCell[];
    weekly: ChartCell[];
    monthly: ChartCell[];
    hourly: ChartCell[];
  };
  chartScore: number;
  weightLost: number;
}

export interface ApiEvaluationGrid {
  period_type: PeriodType;
  period_key: string;
  items: ApiInspectionItem[];
  rows: ApiEvalRow[];
}
export interface EvaluationGrid {
  periodType: PeriodType;
  periodKey: string;
  items: InspectionItem[];
  rows: EvalRow[];
}

export interface SetItemCellPayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
  kind: "item";
  inspection_item_id: number;
  value: ItemValue;
  /** Sent as multipart when present — item cells support a note + images. */
  note?: string | null;
  /** Sent as repeated `images[]` fields. */
  images?: File[];
}
export interface SetChartCellPayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
  kind: "chart";
  cleaning_task_id: number;
  verdict: ChartVerdict;
}
export type SetCellPayload = SetItemCellPayload | SetChartCellPayload;

export interface FinalizePayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
}

/* ── Shared error shape returned by the proxy routes ───────────────────── */

export interface CleaningApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
