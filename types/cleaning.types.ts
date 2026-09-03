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
/** Chart cells no longer accept `auto_fail` — it was arithmetically identical
 *  to `fail` there and the backend rejects it with 422. */
export type ItemValue = "pass" | "fail" | "auto_fail" | "not_applicable" | "empty";
export type ChartVerdict = "pass" | "fail" | "not_applicable";
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

/* ── Track 2: Periods (accounting calendar — server-resolved) ───────────── */

export interface ApiPeriodOption {
  key: string;
  label: string;
  period: number;
  week_in_period: number;
  from: string;
  to: string;
}
export interface PeriodOption {
  key: string;
  label: string;
  period: number;
  weekInPeriod: number;
  from: string;
  to: string;
}

export interface ApiPeriodsResponse {
  current: string;
  options: ApiPeriodOption[];
}
export interface PeriodsResponse {
  current: string;
  options: PeriodOption[];
}

/** The `period` block every evaluation-grid/report response now carries — never
 *  derive these fields (year/week/period/dates) from the key yourself. */
export interface ApiPeriodInfo {
  key: string;
  year: number;
  week: number;
  period: number;
  week_in_period: number;
  label: string;
  from: string;
  to: string;
}
export interface PeriodInfo {
  key: string;
  year: number;
  week: number;
  period: number;
  weekInPeriod: number;
  label: string;
  from: string;
  to: string;
}

/* ── Track 2: Evaluation grid ──────────────────────────────────────────── */

export interface ApiInspectionItem {
  id: number;
  name: string;
  weight: number;
}
export interface InspectionItem {
  id: number;
  name: string;
  weight: number;
}

export interface ApiAllocatedFrom {
  task_id: number;
  name: string;
  amount: number;
}
export interface AllocatedFrom {
  taskId: number;
  name: string;
  amount: number;
}

export interface ApiChartCell {
  task_id: number;
  name: string;
  /** Legacy alias of `effective_weight` — prefer the explicit field. */
  weight: number;
  base_weight: number;
  effective_weight: number;
  allocated_from: ApiAllocatedFrom[];
  verdict: ChartVerdict | null;
  note?: string | null;
  photos?: string[];
  /** Graded before this task became absent under the new period rules —
   *  shown and scored, but not editable. */
  historical?: boolean;
}
export interface ChartCell {
  taskId: number;
  name: string;
  /** Legacy alias of `effectiveWeight` — prefer the explicit field. */
  weight: number;
  baseWeight: number;
  effectiveWeight: number;
  allocatedFrom: AllocatedFrom[];
  verdict: ChartVerdict | null;
  note: string | null;
  /** Relative `/storage/…` URLs — run through `resolvePhotoUrl` before rendering. */
  photos: string[];
  historical: boolean;
}

/** One graded inspection-item cell. */
export interface ItemCell {
  value: ItemValue;
  /** Weight snapshotted at grading time — editing the item later never re-scores this cell. */
  weight: number;
  note: string | null;
  /** Relative `/storage/…` URLs — run through `resolvePhotoUrl` before rendering. */
  photos: string[];
}

/** The API returns `{value, weight, note, photos}` per item; older deploys
 *  returned a bare value string, which `transformEvalRow` still normalizes. */
export type ApiItemCell =
  | ItemValue
  | { value: ItemValue; weight?: number; note?: string | null; photos?: string[] };

export interface ApiAbsentTask {
  task_id: number;
  name: string;
  frequency: CleaningFrequency;
  weight: number;
  reason: string;
  allocated: number;
  unallocated: number;
}
export interface AbsentTask {
  taskId: number;
  name: string;
  frequency: CleaningFrequency;
  weight: number;
  reason: string;
  allocated: number;
  unallocated: number;
}

export interface ApiAllocation {
  source_task_id: number;
  target_task_id: number;
  amount: number;
}
export interface Allocation {
  sourceTaskId: number;
  targetTaskId: number;
  amount: number;
}

export interface ApiMissingCell {
  kind: "item" | "chart";
  id: number;
  name: string;
}
export interface MissingCell {
  kind: "item" | "chart";
  id: number;
  name: string;
}

export type ScoreFormula = "average" | "excel";
export type ScoreSide = "items" | "chart";

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

  absent_tasks: ApiAbsentTask[];
  allocations: ApiAllocation[];

  completion_pct: number;
  is_complete: boolean;
  graded_count: number;
  required_count: number;
  missing: ApiMissingCell[];

  final_score: number | null;
  commitment_pass: boolean;
  score_formula: ScoreFormula;
  score_shares: { items: number; chart: number };
  score_sides: ScoreSide[];
  item_has_auto_fail: boolean;
  score_frozen: boolean;

  finalized_at: string | null;
  finalized_by: string | null;
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

  absentTasks: AbsentTask[];
  allocations: Allocation[];

  completionPct: number;
  isComplete: boolean;
  gradedCount: number;
  requiredCount: number;
  missing: MissingCell[];

  finalScore: number | null;
  commitmentPass: boolean;
  scoreFormula: ScoreFormula;
  scoreShares: { items: number; chart: number };
  scoreSides: ScoreSide[];
  itemHasAutoFail: boolean;
  scoreFrozen: boolean;

  finalizedAt: string | null;
  finalizedBy: string | null;
}

export interface ApiEvaluationGrid {
  period_type: PeriodType;
  period_key: string;
  period: ApiPeriodInfo;
  items: ApiInspectionItem[];
  rows: ApiEvalRow[];
}
export interface EvaluationGrid {
  periodType: PeriodType;
  periodKey: string;
  period: PeriodInfo;
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
  /** `ChartVerdict` for a real grade; `"empty"` DELETES the cell (guide §5/§6)
   *  — never returned on read, only ever sent to clear one. */
  verdict: ChartVerdict | "empty";
}
export type SetCellPayload = SetItemCellPayload | SetChartCellPayload;

export interface FinalizePayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
}

/** Super Admin only — clears the finalize lock and returns the evaluation to
 *  live computation, discarding the frozen scores. */
export type ReopenPayload = FinalizePayload;

/* ── Track 2: Inspection item weight ─────────────────────────────────────── */

export interface UpdateInspectionItemPayload {
  weight: number;
}

/* ── Track 2: Weight allocation ──────────────────────────────────────────── */

export interface GetAllocationsQuery {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
}

export interface SetAllocationPayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
  source_task_id: number;
  /** Sent to the server as `allocations` (confirmed against a live 422 — the
   *  guide's prose never gave a literal field name). Must total the source
   *  task's weight exactly — whole numbers ≥ 1. Replaces the entire split
   *  for this source task in one transaction. */
  amounts: { target_task_id: number; amount: number }[];
}

export interface DeleteAllocationPayload {
  store_id: number;
  period_type: PeriodType;
  period_key: string;
  source_task_id: number;
}

/* ── Track 2: Scoring settings (Super Admin) ─────────────────────────────── */

export interface ApiCleaningSettings {
  score_formula: ScoreFormula;
  /** Some deployments return these flat, others nest them the same way the
   *  evaluation row does (`score_shares: {items, chart}`) — both are
   *  optional here and `transformSettings` accepts either shape. */
  items_share?: number;
  chart_share?: number;
  shares?: { items?: number; chart?: number };
  score_shares?: { items?: number; chart?: number };
  explain: Record<string, string>;
}
export interface CleaningSettings {
  scoreFormula: ScoreFormula;
  itemsShare: number;
  chartShare: number;
  explain: Record<string, string>;
}

export interface UpdateSettingsPayload {
  score_formula?: ScoreFormula;
  items_share?: number;
  chart_share?: number;
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
