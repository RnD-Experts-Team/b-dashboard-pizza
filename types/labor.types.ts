/**
 * Labor Dashboard — response shape for
 * GET {HIRING_BASE_URL}/v1/stores/{storeId}/labor/{date}?trend_weeks=N
 *
 * One request returns the whole page. Two conventions run through every
 * section and must be respected by the UI:
 *
 *  1. `null` (or an absent key in the sparse maps) means "no data recorded",
 *     NOT zero. Rendering 0 would misreport a store that has never had a CSV
 *     import as having worked zero hours.
 *  2. Percentages are already multiplied by 100 — append "%", never multiply.
 */

/* ── Shared ─────────────────────────────────────────────────────────────── */

/** Aggregate stats for one dynamic metric column, store-wide for the week. */
export interface LaborColumnStats {
  label: string;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  /** How many employee-day values contributed. */
  count: number;
}

/**
 * Keyed by metric column key (e.g. "hourly_pay", "total_hours", "sales").
 * Keys are DYNAMIC — new columns appear automatically whenever a CSV import
 * contains a new header. Never narrow this to a union of literals.
 */
export type LaborByColumn = Record<string, LaborColumnStats>;

/** Row-level metric — lighter than LaborColumnStats (no min/max/count). */
export type LaborEmployeeMetric = Pick<LaborColumnStats, "label" | "sum" | "avg">;

export type SeparationType = "voluntary" | "involuntary";
export type EmployeeStatus = "active" | "inactive";

/* ── summary ────────────────────────────────────────────────────────────── */

export interface LaborSummary {
  headcount_current: number;
  new_hires_this_week: number;
  separations_this_week: number;
  /** Separations flagged as "may have been a good employee". Highlight if > 0. */
  notable_departures_this_week: number;
  turnover_rate_this_week_percent: number | null;
  avg_weekly_turnover_rate_trailing_percent: number | null;
  avg_weekly_gross_pay_trailing: number | null;
  avg_weekly_hours_trailing: number | null;
  employees_over_40_hours: number;
  employees_over_60_hours: number;
}

/* ── headcount ──────────────────────────────────────────────────────────── */

export interface LaborPositionCount {
  position: string;
  count: number;
}

export interface LaborHeadcount {
  active_start_of_week: number;
  active_end_of_week: number;
  new_hires: number;
  separations: number;
  /** new_hires - separations. Can be negative. */
  net_change: number;
  /** Already sorted descending by count — do not re-sort. */
  by_position: LaborPositionCount[];
}

/* ── tenure ─────────────────────────────────────────────────────────────── */

export interface LaborTenureBucket {
  bucket: string;
  count: number;
}

export interface LaborTenureEmployee {
  employee_id: number;
  name: string;
  /** Start of CURRENT stint, not necessarily their first day ever. */
  hire_date: string;
  tenure_days: number;
}

export interface LaborTenure {
  average_tenure_days: number | null;
  /** Fixed buckets in a fixed order, zeros included — render as given. */
  distribution: LaborTenureBucket[];
  newest_hires: LaborTenureEmployee[];
  longest_tenured: LaborTenureEmployee[];
}

/* ── turnover ───────────────────────────────────────────────────────────── */

export interface LaborTurnoverReason {
  /** snake_case enum value, or the literal "unknown". */
  reason: string;
  type: SeparationType;
  count: number;
}

/** "Did we lose a good one?" — employee vs. store average, same window. */
export interface LaborImpactSnapshot {
  lookback_days: number;
  avg_weekly_hours: number | null;
  avg_hourly_pay: number | null;
  avg_performance_score: number | null;
  store_avg_weekly_hours_same_period: number | null;
  store_avg_performance_score_same_period: number | null;
  /** Tri-state: `null` means not enough data to compare — render neutral. */
  above_average_hours: boolean | null;
  above_average_performance: boolean | null;
}

export interface LaborTurnoverEvent {
  employee_id: number;
  name: string | null;
  type: SeparationType;
  effective_date: string;
  /** Best-effort match — "likely reason", not a hard fact. */
  reason: string | null;
  /** `false` is expected and common, not an error → show "Not recorded". */
  reason_matched: boolean;
  tenure_days: number | null;
  impact_snapshot: LaborImpactSnapshot;
}

export interface LaborTurnover {
  separations_count: number;
  voluntary_count: number;
  involuntary_count: number;
  turnover_rate_percent: number | null;
  by_reason: LaborTurnoverReason[];
  events: LaborTurnoverEvent[];
}

/* ── labor ──────────────────────────────────────────────────────────────── */

/** Curated, already-rounded headline numbers. Any of them can be null. */
export interface LaborHighlights {
  total_hours: number | null;
  average_hourly_pay: number | null;
  total_gross_pay: number | null;
  average_gross_pay_per_employee: number | null;
  /** Already ×100. */
  average_labor_percent: number | null;
  total_sales: number | null;
  total_tips: number | null;
  average_performance_score: number | null;
  average_final_score: number | null;
}

export interface LaborMetrics {
  highlights: LaborHighlights;
  by_column: LaborByColumn;
}

/* ── overtime ───────────────────────────────────────────────────────────── */

export interface LaborOvertimeEmployee {
  employee_id: number;
  name: string | null;
  position: string | null;
  total_hours: number;
  /** total_hours - 40. Only present on the 40h+ list. */
  overtime_hours?: number;
}

export interface LaborOvertime {
  /** Read this rather than hardcoding 40 — it may change. */
  over_40_hours_threshold: number;
  over_40_hours_count: number;
  /** Sorted descending by total_hours. */
  over_40_hours: LaborOvertimeEmployee[];
  over_60_hours_threshold: number;
  over_60_hours_count: number;
  /** Always a subset of over_40_hours. Sorted descending by total_hours. */
  over_60_hours: LaborOvertimeEmployee[];
}

/* ── trend ──────────────────────────────────────────────────────────────── */

/** Metric fields of one trailing week (everything except the date bounds). */
export interface LaborTrendMetrics {
  headcount_active_end: number | null;
  new_hires: number | null;
  separations: number | null;
  turnover_rate_percent: number | null;
  total_hours: number | null;
  average_hourly_pay: number | null;
  total_gross_pay: number | null;
  /** Already ×100. */
  average_labor_percent: number | null;
  total_sales: number | null;
  average_performance_score: number | null;
}

export interface LaborTrendWeek extends LaborTrendMetrics {
  week_start: string;
  week_end: string;
}

export interface LaborTrendComparison {
  /** One of "total_gross_pay" | "total_hours" | "turnover_rate_percent". */
  metric: string;
  this_week: number | null;
  trailing_average: number | null;
  /** `null` when either side is missing or the average is exactly 0. */
  delta_percent: number | null;
}

export interface LaborTrend {
  /** Oldest first. The LAST entry is always the requested week itself. */
  weeks: LaborTrendWeek[];
  /** Average across `weeks`, nulls excluded. The "typical week" baseline. */
  averages: Partial<LaborTrendMetrics>;
  comparison_to_average: LaborTrendComparison[];
}

/* ── employees ──────────────────────────────────────────────────────────── */

export interface LaborEmployee {
  employee_id: number;
  name: string;
  position: string | null;
  status: EmployeeStatus;
  /** Start of current stint. Null if no hire/rehire history at all. */
  hire_date: string | null;
  tenure_days: number | null;
  /** Decimal string, e.g. "14.00" — already formatted. */
  base_pay: string | null;
  performance_pay: string | null;
  /** Sparse — only columns with a recorded value for this employee this week. */
  metrics: Record<string, LaborEmployeeMetric>;
}

/* ── root ───────────────────────────────────────────────────────────────── */

export interface LaborDashboardResponse {
  /** The store_number the report was run for. */
  store: string;
  /** The date that was requested (any day inside the business week). */
  date: string;
  /** Business week the API snapped to — Tuesday. */
  week_start: string;
  /** Business week end — Monday. */
  week_end: string;
  summary: LaborSummary;
  headcount: LaborHeadcount;
  tenure: LaborTenure;
  turnover: LaborTurnover;
  labor: LaborMetrics;
  overtime: LaborOvertime;
  trend: LaborTrend;
  employees: LaborEmployee[];
}
