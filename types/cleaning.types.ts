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
  /** Ever completed, in any period — not just this one. */
  has_history: boolean;
  completions_count: number;
  /** Whether derivable past periods can exist for this task at all. */
  started_at_or_before_period: boolean;
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
  hasHistory: boolean;
  completionsCount: number;
  startedAtOrBeforePeriod: boolean;
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

/** Who/what decided the current `verdict` — an auditor's real grade, or the
 *  system substituting an auto-fail for a task the store never logged. */
export type ChartVerdictSource = "auditor" | "system";

/** Whether a task's required completions for this period were logged at all
 *  (distinct from whether an auditor has graded it). `pending` means the
 *  period hasn't reached this task's due occurrence yet — locked, but not
 *  failed (see `ChartLockReason`). */
export type ChartCompletionStatus = "done" | "pending" | "partial" | "missing";

/** `period_not_finished` = locked but NOT failed (deadline hasn't passed,
 *  `verdict` stays null). `not_completed`/`partially_completed` = locked AND
 *  auto-failed (deadline passed with nothing/not-enough logged). These two
 *  families must render differently — see `renderChartChip`. */
export type ChartLockReason = "period_not_finished" | "not_completed" | "partially_completed";

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

  /** Sept 2026: completion-lock fields (FRONTEND-guide.md §1-2). */
  verdict_source?: ChartVerdictSource | null;
  /** Only occurrences already past their deadline — drives auto-fail. */
  completion_expected?: number;
  completion_found?: number;
  /** Everything the period asks for — drives whether the cell is editable
   *  at all (`evaluable`), regardless of deadlines. */
  completion_expected_period?: number;
  completion_found_period?: number;
  completion_pct?: number;
  completion_status?: ChartCompletionStatus;
  completion_done?: boolean;
  completion_late?: boolean;
  last_done_at?: string | null;
  done_by?: string[];
  /** `false` = read-only, no verdict of any kind accepted (guide §2). */
  evaluable?: boolean;
  /** `true` only when the deadline has passed with nothing/not-enough
   *  logged — the explicit flag for "the system failed it," distinct from
   *  `evaluable === false` alone (which also covers the not-yet-due case). */
  auto_failed?: boolean;
  lock_reason?: ChartLockReason | null;
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

  verdictSource: ChartVerdictSource | null;
  completionExpected: number;
  completionFound: number;
  completionExpectedPeriod: number;
  completionFoundPeriod: number;
  completionPct: number;
  completionStatus: ChartCompletionStatus;
  completionDone: boolean;
  completionLate: boolean;
  lastDoneAt: string | null;
  doneBy: string[];
  evaluable: boolean;
  autoFailed: boolean;
  lockReason: ChartLockReason | null;
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

  /** Sept 2026: row-level rollup of the completion-lock feature. */
  completion_enforced?: boolean;
  tasks_not_completed?: number;
  tasks_auto_failed?: number;
  tasks_in_play?: number;
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

  completionEnforced: boolean;
  tasksNotCompleted: number;
  tasksAutoFailed: number;
  tasksInPlay: number;
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

/** Gated by the "cleaning specialist" permission (confirmed against the live
 *  permission registry — not Super Admin only, despite the migration guide's
 *  prose). Clears the finalize lock and returns the evaluation to live
 *  computation, discarding the frozen scores. */
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

/* ── Track 2: Copy a store's weight split to other stores ───────────────── */

export type AllocationCopySkipReason =
  | "nothing_to_copy"
  | "evaluation_already_finalized"
  | "source_task_not_absent_here"
  | "target_task_not_in_play"
  | "split_does_not_match_weight"
  | "store_not_visible";

export interface AllocationCopyRequest {
  source_store_id: number;
  /** Max 50; the source store is ignored if included. */
  target_store_ids: number[];
  period_type: PeriodType;
  period_key: string;
  /** Preview only — writes nothing. Always send `true` first. */
  dry_run?: boolean;
}

export interface ApiAllocationCopySplitTarget {
  target_task_id: number;
  amount: number;
}
export interface AllocationCopySplitTarget {
  targetTaskId: number;
  amount: number;
}

export interface ApiAllocationCopySplit {
  source_task_id: number;
  name: string;
  targets: ApiAllocationCopySplitTarget[];
  replaces_existing: boolean;
}
export interface AllocationCopySplit {
  sourceTaskId: number;
  name: string;
  targets: AllocationCopySplitTarget[];
  replacesExisting: boolean;
}

export interface ApiAllocationCopySkip {
  reason: AllocationCopySkipReason;
  detail?: string;
}
export interface AllocationCopySkip {
  reason: AllocationCopySkipReason;
  detail: string | null;
}

export interface ApiAllocationCopyResult {
  store_id: number;
  store: string;
  copied: number;
  skipped?: ApiAllocationCopySkip[];
  splits?: ApiAllocationCopySplit[];
}
export interface AllocationCopyResult {
  storeId: number;
  store: string;
  copied: number;
  skipped: AllocationCopySkip[];
  splits: AllocationCopySplit[];
}

export interface ApiAllocationCopyResponse {
  dry_run: boolean;
  source: { store_id: number; store: string; splits: number; rows: number };
  period: { period_type: PeriodType; period_key: string };
  results: ApiAllocationCopyResult[];
}
export interface AllocationCopyResponse {
  dryRun: boolean;
  source: { storeId: number; store: string; splits: number; rows: number };
  period: { periodType: PeriodType; periodKey: string };
  results: AllocationCopyResult[];
}

/* ── Track 2: Remove saved splits from several stores at once ───────────── */

/** `nothing_to_remove` is NOT an error — the call is idempotent, so pressing
 *  Remove twice is harmless (remove-button guide §1). */
export type AllocationRemoveSkipReason = "evaluation_already_finalized" | "nothing_to_remove";

export interface AllocationRemoveRequest {
  /** 1–50, no duplicates. Unlike the copy endpoint, the store the auditor is
   *  currently looking at IS allowed here. */
  store_ids: number[];
  period_type: PeriodType;
  period_key: string;
  /** Omit to clear EVERY split in the period (the "I copied by mistake"
   *  case); pass ids to remove only those and leave the rest alone. */
  source_task_ids?: number[];
  /** Preview only — writes nothing. Always send `true` first. */
  dry_run?: boolean;
}

export interface ApiAllocationRemoveSplit {
  source_task_id: number;
  name: string;
  amount: number;
  /** How many receiving tasks this one split fed. */
  targets: number;
}
export interface AllocationRemoveSplit {
  sourceTaskId: number;
  name: string;
  amount: number;
  targets: number;
}

export interface ApiAllocationRemoveSkip {
  reason: AllocationRemoveSkipReason;
  detail?: string;
}
export interface AllocationRemoveSkip {
  reason: AllocationRemoveSkipReason;
  detail: string | null;
}

export interface ApiAllocationRemoveResult {
  store_id: number;
  store: string;
  /** Counts SPLITS (source tasks), not database rows — one split feeding 3
   *  receiving tasks is `removed: 1`, `targets: 3`. */
  removed: number;
  skipped?: ApiAllocationRemoveSkip[];
  splits?: ApiAllocationRemoveSplit[];
}
export interface AllocationRemoveResult {
  storeId: number;
  store: string;
  removed: number;
  skipped: AllocationRemoveSkip[];
  splits: AllocationRemoveSplit[];
}

export interface ApiAllocationRemoveResponse {
  dry_run: boolean;
  period: { period_type: PeriodType; period_key: string };
  scope: "all_splits" | "selected_tasks";
  results: ApiAllocationRemoveResult[];
}
export interface AllocationRemoveResponse {
  dryRun: boolean;
  period: { periodType: PeriodType; periodKey: string };
  scope: "all_splits" | "selected_tasks";
  results: AllocationRemoveResult[];
}

/* ── Track 2: Scoring settings (gated by the "cleaning specialist" permission,
   confirmed against the live registry — not Super Admin only) ───────────── */

export type ChartCompletionRule = "all" | "any" | "threshold";

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

  /** Sept 2026: chart-completion-lock settings (FRONTEND-guide.md §4). */
  chart_requires_completion?: boolean;
  completion_rule?: ChartCompletionRule;
  /** Only meaningful when `completion_rule === "threshold"`. */
  completion_threshold?: number;
}
export interface CleaningSettings {
  scoreFormula: ScoreFormula;
  itemsShare: number;
  chartShare: number;
  explain: Record<string, string>;

  chartRequiresCompletion: boolean;
  completionRule: ChartCompletionRule;
  completionThreshold: number;
}

export interface UpdateSettingsPayload {
  score_formula?: ScoreFormula;
  items_share?: number;
  chart_share?: number;
  chart_requires_completion?: boolean;
  completion_rule?: ChartCompletionRule;
  completion_threshold?: number;
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
