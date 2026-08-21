import type { EmployeeDebriefType } from "./employee-debrief.types";

/**
 * Employee Report — roster + debrief counts for a store/week.
 * GET {DATA_API_URL}/reports/employees/{store}/{date}?trend_weeks=N
 *
 * Distinct upstream/domain from the Labor Dashboard's hours/pay report
 * (types/labor.types.ts) — this one is entirely about employee debrief
 * activity (manager notes like "call off", "no call no show").
 *
 * Two conventions carried over from that report apply here too:
 *  - `null` means "no data", never coerce to 0.
 *  - `by_type` is an OPEN catalog (`debrief_types`) — new types can appear
 *    upstream at any time. Always iterate the array; never hardcode the two
 *    known slugs ("call_off", "no_call_no_show").
 */

/** `type.id === null` is the always-present "untyped" bucket, not an edge case. */
export interface DebriefByTypeEntry {
  type: EmployeeDebriefType | null;
  count: number;
}

export interface DebriefTrendByTypeEntry {
  type: EmployeeDebriefType | null;
  average_count: number;
}

/* ── summary ────────────────────────────────────────────────────────────── */

export interface EmployeeReportSummary {
  active_employees: number;
  total_debriefs_this_week: number;
  /** null when there were no debriefs at all this week. */
  most_common_type_this_week: EmployeeDebriefType | null;
  avg_weekly_debriefs_trailing: number | null;
}

/* ── headcount ──────────────────────────────────────────────────────────── */

export interface EmployeeReportHeadcount {
  active: number;
  inactive: number;
  total: number;
}

/* ── debriefs ───────────────────────────────────────────────────────────── */

export interface DebriefEvent {
  debrief_id: number;
  employee_id: number;
  employee_name: string;
  /** Best-effort at read time — a debrief can be saved with no type at all. */
  type: EmployeeDebriefType | null;
  date: string;
  note: string | null;
  author: string | null;
}

export interface EmployeeReportDebriefs {
  total_count: number;
  /** Always lists every catalog type + the untyped bucket, sorted by count desc. */
  by_type: DebriefByTypeEntry[];
  /** Newest first. */
  events: DebriefEvent[];
}

/* ── trend ──────────────────────────────────────────────────────────────── */

export interface EmployeeReportTrendWeek {
  week_start: string;
  week_end: string;
  total_count: number;
  by_type: DebriefByTypeEntry[];
}

export interface EmployeeReportTrendAverages {
  total_count: number;
  by_type: DebriefTrendByTypeEntry[];
}

export interface EmployeeReportTrend {
  /** Oldest first. The last entry is always the requested week itself. */
  weeks: EmployeeReportTrendWeek[];
  averages: EmployeeReportTrendAverages;
}

/* ── employees ──────────────────────────────────────────────────────────── */

export interface EmployeeReportEmployeeDebriefs {
  total_count: number;
  by_type: DebriefByTypeEntry[];
}

export interface EmployeeReportEmployee {
  employee_id: number;
  name: string;
  /** A roster snapshot flag — currently employed, not "active this week". */
  active: boolean;
  debriefs_this_week: EmployeeReportEmployeeDebriefs;
}

/* ── root ───────────────────────────────────────────────────────────────── */

export interface EmployeeReportResponse {
  store: string;
  date: string;
  week_start: string;
  week_end: string;
  summary: EmployeeReportSummary;
  headcount: EmployeeReportHeadcount;
  /** The live catalog — iterate this, don't hardcode known slugs. */
  debrief_types: EmployeeDebriefType[];
  debriefs: EmployeeReportDebriefs;
  trend: EmployeeReportTrend;
  employees: EmployeeReportEmployee[];
}
