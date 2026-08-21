/* ──────────────────────────────────────────────────────────────────────────
 *  labor-format — display helpers for the Labor Dashboard.
 *
 *  The single most important rule on this page lives here: a null/undefined
 *  metric renders as an em dash, never as 0. A store with no CSV import yet
 *  must not read as "worked zero hours". Every formatter below enforces it,
 *  so no component should ever do its own `?? 0`.
 * ────────────────────────────────────────────────────────────────────────── */

import type { LaborTrendMetrics } from "@/types/labor.types";

export const DASH = "—";

type Num = number | null | undefined;

const isNum = (v: Num): v is number => typeof v === "number" && Number.isFinite(v);

/* ── Numbers, currency, percentages ─────────────────────────────────────── */

export function fmtNumber(v: Num, digits = 0): string {
  if (!isNum(v)) return DASH;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtCurrency(v: Num, digits = 2): string {
  if (!isNum(v)) return DASH;
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Values arrive already ×100 — append the sign, never multiply again. */
export function fmtPercent(v: Num, digits = 1): string {
  if (!isNum(v)) return DASH;
  return `${fmtNumber(v, digits)}%`;
}

export function fmtHours(v: Num, digits = 1): string {
  if (!isNum(v)) return DASH;
  return `${fmtNumber(v, digits)}h`;
}

/** Signed delta, for the trend comparison callouts. */
export function fmtDelta(v: Num, digits = 1): string {
  if (!isNum(v)) return DASH;
  return `${v > 0 ? "+" : ""}${fmtNumber(v, digits)}%`;
}

/** `base_pay` / `performance_pay` arrive as decimal strings, e.g. "14.00". */
export function fmtDecimalString(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return DASH;
  const n = Number(v);
  return Number.isFinite(n) ? fmtCurrency(n) : v;
}

/* ── Tenure ─────────────────────────────────────────────────────────────── */

/**
 * The API only ever sends raw days — convert to a friendlier unit here.
 *
 * `days` is only ever `null` when there's no data — never treat a negative
 * number as "missing" and hide it. The upstream tenure calculation has been
 * observed returning negative values (hire dates in the past yielding a
 * negative day count), which looks like a backend bug, but the frontend's
 * job is to render what it's given accurately, not to silently blank out
 * real numbers because their sign looks wrong.
 */
export function fmtTenure(days: Num): string {
  if (!isNum(days)) return DASH;
  const sign = days < 0 ? "-" : "";
  const abs = Math.abs(days);
  if (abs < 60) return `${sign}${Math.round(abs)} day${Math.round(abs) === 1 ? "" : "s"}`;
  if (abs < 365) return `${sign}${(abs / 30.44).toFixed(1)} months`;
  return `${sign}${(abs / 365.25).toFixed(1)} years`;
}

/* ── Separation reasons ─────────────────────────────────────────────────── */

/**
 * The API sends snake_case enum values with no human-readable labels, so the
 * map lives client-side. Unknown keys fall back to a title-cased version of
 * the raw value, so a new enum member degrades gracefully instead of blanking.
 */
export const SEPARATION_REASON_LABELS: Record<string, string> = {
  // Resignation — voluntary
  found_another_job: "Found another job",
  school_schedule_conflict: "School schedule conflict",
  relocation: "Relocation",
  personal_reasons: "Personal reasons",
  health_family_reasons: "Health / family reasons",
  cognito_form: "Cognito form",
  // Termination — involuntary
  performance_issues: "Performance issues",
  policy_violation_misconduct: "Policy violation / misconduct",
  attendance_issues: "Attendance issues",
  no_call_no_show_more_than_2_times_job_abandonment:
    "No call / no show (job abandonment)",
  end_of_trial_period: "End of trial period",
  reach_the_limits_of_caps_needed: "Reached cap limits",
  // Shared
  other: "Other",
};

export const REASON_NOT_RECORDED = "Not recorded";

function titleCase(raw: string): string {
  return raw
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * `reason_matched: false` is expected and common — it just means no separation
 * request could be tied to the event. It must read as "Not recorded", never as
 * a blank cell or an error.
 */
export function reasonLabel(
  reason: string | null | undefined,
  reasonMatched?: boolean,
): string {
  if (reasonMatched === false) return REASON_NOT_RECORDED;
  if (!reason || reason === "unknown") return REASON_NOT_RECORDED;
  return SEPARATION_REASON_LABELS[reason] ?? titleCase(reason);
}

/* ── Metric column hints ────────────────────────────────────────────────── */

export type StatHint = "sum" | "avg" | "both";

/**
 * Which stat is meaningful per metric column. The API does not indicate this,
 * so it's a client-side reference — and only ever an EMPHASIS hint: the table
 * always renders sum/avg/min/max, so a brand-new column (created upstream by a
 * CSV header we've never seen) still displays correctly with no code change.
 */
export const COLUMN_STAT_HINT: Record<string, StatHint> = {
  // Rates and ratings — not additive
  hourly_pay: "avg",
  labor: "avg",
  final_score: "avg",
  performance_score: "avg",
  // Additive hours / dollars
  total_hours: "sum",
  total_tips: "sum",
  sales: "sum",
  money_owed: "sum",
  amazon_wm_others: "sum",
  base_pay: "sum",
  performance_bonus: "sum",
  gross_pay: "sum",
  team_profit_sharing: "sum",
  bread_boost_bonus: "sum",
  extra_pay: "sum",
  total_deduction: "sum",
  tax_allowans: "sum",
  rent_pmt: "sum",
  phone_pmt: "sum",
  utilities: "sum",
  others: "sum",
  company_loan: "sum",
  legal: "sum",
  car: "sum",
  // Audit / rating style — meaning unconfirmed with ops, so show both.
  positive: "both",
  lc_audit: "both",
  customer_service: "both",
  upselling: "both",
  inventory: "both",
  pne_audit_fail: "both",
};

export function preferredStat(key: string): StatHint {
  return COLUMN_STAT_HINT[key] ?? "both";
}

/** Columns whose values are dollar amounts, for currency formatting. */
const CURRENCY_COLUMNS = new Set([
  "hourly_pay",
  "total_tips",
  "sales",
  "money_owed",
  "amazon_wm_others",
  "base_pay",
  "performance_bonus",
  "gross_pay",
  "team_profit_sharing",
  "bread_boost_bonus",
  "extra_pay",
  "total_deduction",
  "tax_allowans",
  "rent_pmt",
  "phone_pmt",
  "utilities",
  "others",
  "company_loan",
  "legal",
  "car",
]);

/** Formats a metric value according to what kind of column it came from. */
export function fmtColumnValue(key: string, v: Num): string {
  if (!isNum(v)) return DASH;
  if (key === "labor") return fmtPercent(v);
  if (key === "total_hours") return fmtHours(v);
  if (CURRENCY_COLUMNS.has(key)) return fmtCurrency(v);
  return fmtNumber(v, Number.isInteger(v) ? 0 : 2);
}

/* ── Trend metric selector ──────────────────────────────────────────────── */

export interface TrendMetricConfig {
  key: keyof LaborTrendMetrics;
  label: string;
  format: (v: Num) => string;
  /** False for turnover rate — a rise there is bad, unlike every other metric. */
  higherIsBetter: boolean;
}

export const TREND_METRICS: TrendMetricConfig[] = [
  {
    key: "headcount_active_end",
    label: "Headcount",
    format: (v) => fmtNumber(v),
    higherIsBetter: true,
  },
  {
    key: "total_hours",
    label: "Total Hours",
    format: (v) => fmtHours(v),
    higherIsBetter: true,
  },
  {
    key: "total_gross_pay",
    label: "Gross Pay",
    format: (v) => fmtCurrency(v, 0),
    higherIsBetter: true,
  },
  {
    key: "turnover_rate_percent",
    label: "Turnover Rate",
    format: (v) => fmtPercent(v),
    higherIsBetter: false,
  },
  {
    key: "total_sales",
    label: "Sales",
    format: (v) => fmtCurrency(v, 0),
    higherIsBetter: true,
  },
  {
    key: "average_performance_score",
    label: "Performance Score",
    format: (v) => fmtNumber(v, 2),
    higherIsBetter: true,
  },
  {
    key: "average_hourly_pay",
    label: "Avg Hourly Pay",
    format: (v) => fmtCurrency(v),
    higherIsBetter: true,
  },
  {
    key: "average_labor_percent",
    label: "Labor %",
    format: (v) => fmtPercent(v),
    higherIsBetter: false,
  },
];

/** Labels + direction for the three `comparison_to_average` metrics. */
export function trendMetricConfig(key: string): TrendMetricConfig | undefined {
  return TREND_METRICS.find((m) => m.key === key);
}
