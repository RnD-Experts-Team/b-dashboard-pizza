/**
 * Business Reports — Dashboard V1 and the Labor report for many stores over
 * any date range.
 *
 * Every section is pre-aggregated upstream and fetched on its own, in parallel:
 *   - Data  POST /reports/business/{section}  (sales, operations, menu, orders,
 *           quality, debriefs, store-score)  → app/api/reports/business/[section]
 *   - Hiring GET /v1/reports/labor            → app/api/reports/labor
 *   - Hooks GET /reports/wbr/bulk             → app/api/reports/wbr-bulk
 *   - Maintenance GET /maintenance-analytics/summary → app/api/maintenance-tickets/analytics/summary
 *   - Operations GET /v1/skills/overview → app/api/scheduling/skills/overview
 *
 * Shapes mirror the upstream JSON (snake_case). Stores are store numbers
 * ("03795-00001"), always sent as an explicit list.
 */

import type { AnalyticsSummary } from "@/types/maintenance-analytics.types";
import type { StoreSkillsOverview } from "@/types/skills.types";
import type { SalesHistory } from "@/types/dashboard-report.types";

/* ══════════════════════════════════════════════════════════════════════
 *  Request
 * ══════════════════════════════════════════════════════════════════════ */

/** A store picker's value: an explicit list, or every store offered (shared by other pages' pickers). */
export type StoreSelection = string[] | "all";

export interface BusinessReportsParams {
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  /** YYYY-MM-DD, inclusive. */
  endDate: string;
  /** Store numbers, e.g. "03795-00001". */
  stores: string[];
  /** Also load the store-score grid — slow on big ranges, so only when asked for. */
  withStoreScore: boolean;
}

/* ══════════════════════════════════════════════════════════════════════
 *  Shared (Data sections)
 * ══════════════════════════════════════════════════════════════════════ */

/** A Tue–Mon business week overlapping the range. */
export interface ReportWeek {
  /** The Tuesday — the key of every by-week block. */
  week_start: string;
  /** The Monday. */
  week_end: string;
  /** The part of the week inside the range. */
  start: string;
  end: string;
  fiscal_year: number;
  week_number: number;
  period_number: number;
  quarter_number: number;
}

export interface ReportMeta {
  start_date: string;
  end_date: string;
  days: number;
  stores: string[];
  store_count: number;
  weeks: ReportWeek[];
}

export const CHANNEL_KEYS = [
  "phone",
  "website",
  "mobile",
  "call_center",
  "drive_thru",
  "doordash",
  "ubereats",
  "grubhub",
] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export const CATEGORY_KEYS = [
  "pizza",
  "hnr",
  "bread",
  "wings",
  "beverages",
  "other_foods",
  "side_items",
] as const;
export type CategoryKeyName = (typeof CATEGORY_KEYS)[number];

/* ══════════════════════════════════════════════════════════════════════
 *  sales
 * ══════════════════════════════════════════════════════════════════════ */

/** `<channel>_orders` / `<channel>_sales`. */
export type ChannelFields = {
  [K in ChannelKey as `${K}_orders` | `${K}_sales`]: number;
};

/** `<category>_<delivery|carryout>_<quantity|sales>`. */
export type CategoryFields = {
  [K in CategoryKeyName as `${K}_${"delivery" | "carryout"}_${"quantity" | "sales"}`]: number;
};

/**
 * Summed daily_store_summary figures plus deposit, waste and labor, with the
 * derived ratios. `sales` = royalty obligation (the figure V1 calls sales).
 * `store_days` = how many store-days had a daily row (for per-store-day avgs).
 */
export interface SalesMetrics extends ChannelFields, CategoryFields {
  store_days: number;
  sales: number;
  royalty_obligation: number;
  gross_sales: number;
  net_sales: number;
  refund_amount: number;
  total_orders: number;
  completed_orders: number;
  /** Shown as "voided" in V1's cash control. */
  cancelled_orders: number;
  modified_orders: number;
  refunded_orders: number;
  customer_count: number;
  delivery_orders: number;
  delivery_sales: number;
  carryout_orders: number;
  carryout_sales: number;
  sales_tax: number;
  delivery_fees: number;
  delivery_tips: number;
  store_tips: number;
  total_tips: number;
  cash_sales: number;
  over_short: number;
  portal_eligible_orders: number;
  portal_used_orders: number;
  portal_on_time_orders: number;
  digital_orders: number;
  digital_sales: number;
  hnr_transactions: number;
  hnr_broken_promises: number;
  hnr_promise_met: number;
  hnr_promise_met_percent: number;
  deposit: number;
  deposit_minus_cash_sales: number;
  waste_normal: number;
  waste_alta: number;
  labor_cost: number;
  /** labor_cost ÷ sales × 100 (V1's week-to-date definition). */
  labor_percent: number;
  /** sales ÷ customers. */
  avg_ticket: number;
  /** sales ÷ orders. */
  avg_order_value: number;
  /** sales − every channel (V1's "In Store" / Register). */
  register_sales: number;
  delivery_rate: number;
  digital_penetration: number;
}

export type SalesWeek = ReportWeek & SalesMetrics;

/** `by_date` rows carry only the daily figures. */
export interface SalesDay {
  date: string;
  store_days: number;
  sales: number;
  gross_sales: number;
  total_orders: number;
  customer_count: number;
  cash_sales: number;
  over_short: number;
  total_tips: number;
  refund_amount: number;
  refunded_orders: number;
  deposit: number;
  deposit_minus_cash_sales: number;
  waste_normal: number;
  waste_alta: number;
  labor_cost: number;
  labor_percent: number;
  avg_ticket: number;
  avg_order_value: number;
}

export interface StoreWeekCompact {
  sales: number;
  customer_count: number;
  total_orders: number;
  labor_cost: number;
  labor_percent: number;
  store_days: number;
}

export interface HourlyRow {
  hour: number;
  /** Store-days that had a row at this hour (divide for a per-store-day avg). */
  store_days: number;
  total_sales: number;
  register_sales: number;
  phone_sales: number;
  website_sales: number;
  mobile_sales: number;
  call_center_sales: number;
  drive_thru_sales: number;
  doordash_sales: number;
  ubereats_sales: number;
  grubhub_sales: number;
}

export interface SalesSection {
  meta: ReportMeta;
  totals: SalesMetrics;
  by_store: Record<string, SalesMetrics>;
  by_week: SalesWeek[];
  /** store → week_start → compact figures. */
  by_store_week: Record<string, Record<string, StoreWeekCompact>>;
  by_date: SalesDay[];
  hourly: HourlyRow[];
}

/* ══════════════════════════════════════════════════════════════════════
 *  operations
 * ══════════════════════════════════════════════════════════════════════ */

export interface HnrTotals {
  hnr_transactions: number;
  hnr_broken_promises: number;
  hnr_promise_met: number;
  hnr_promise_met_percent: number;
}

export interface OperationsMetrics extends HnrTotals {
  sales: number;
  portal_eligible_orders: number;
  portal_used_orders: number;
  portal_on_time_orders: number;
  /** Store-days with eligible orders (the portal %s are their mean). */
  portal_days: number;
  put_into_portal_percent: number;
  in_portal_on_time_percent: number;
  blue_line_total: number;
  pepsi_total: number;
  blue_line_pct: number;
  pepsi_pct: number;
  calls_total: number;
  calls_missed: number;
  calls_store: number;
  calls_store_manager: number;
  calls_call_center: number;
  transfers_in_count: number;
  transfers_in_cost: number;
  transfers_out_count: number;
  transfers_out_cost: number;
  non_negotiable_count: number;
  non_negotiable_downtime: number;
}

export interface HnrPlusTotals {
  made: number;
  sold: number;
  voided: number;
  wasted: number;
  variance: number;
  no_inventory_available: number;
  sold_percent: number;
  void_percent: number;
  waste_percent: number;
  variance_percent: number;
  no_inventory_percent: number;
  variance_score: number;
  sold_score: number;
  no_inventory_score: number;
  void_score: number;
  waste_score: number;
  total_score: number;
}

export interface HnrPlusItemRow {
  item_id: string;
  item_name: string;
  made: number;
  sold: number;
  voided: number;
  wasted: number;
  variance: number;
  no_inventory_available: number;
}

export interface TransferRow {
  date: string;
  from_store_number: string;
  to_store_number: string;
  ing_des: string;
  quantity: number;
  unit: string;
  total_cost: number;
}

export interface NonNegotiableRow {
  store: string;
  action: string;
  date: string;
  time: string | null;
  date_two: string | null;
  time_two: string | null;
  notes: string | null;
}

export interface OperationsSection {
  meta: ReportMeta;
  totals: OperationsMetrics;
  by_store: Record<string, OperationsMetrics>;
  by_week: Array<ReportWeek & OperationsMetrics>;
  by_store_week: Record<string, Record<string, OperationsMetrics>>;
  hnr_plus: {
    totals: HnrPlusTotals;
    by_store: Record<string, HnrPlusTotals>;
    by_week: Array<{ week_start: string } & HnrPlusTotals>;
    by_store_week: Record<string, Record<string, { total_score: number; made: number }>>;
    items: HnrPlusItemRow[];
  };
  transfers: TransferRow[];
  non_negotiables: NonNegotiableRow[];
}

/* ══════════════════════════════════════════════════════════════════════
 *  menu
 * ══════════════════════════════════════════════════════════════════════ */

export interface TopItem {
  item_id: string;
  menu_item_name: string;
  gross_sales: number;
  quantity_sold: number;
}

export interface IngredientRow {
  ingredient_id: string;
  ingredient_description: string;
  actual_usage: number;
  variance_value: number;
}

export interface PortioningBlock {
  theo_usage: number;
  variance_breakdown: Array<{
    ingredient_id: string;
    ingredient_description: string;
    variance_value: number;
    percentage_of_theo_usage: number;
  }>;
}

export interface LtoTotals {
  total_sales: number;
  total_quantity: number;
  pct_of_store_sales: number;
  pct_of_store_quantity: number;
}

export interface MenuSection {
  meta: ReportMeta;
  top_items: {
    by_sales: TopItem[];
    by_count: TopItem[];
    by_store: Record<string, { by_sales: TopItem[]; by_count: TopItem[] }>;
  };
  lto: {
    store_totals: { total_sales: number; total_quantity: number };
    lto_totals: LtoTotals;
    items: Array<{
      item_id: string;
      sales: number;
      quantity: number;
      pct_of_store_sales: number;
      pct_of_store_quantity: number;
    }>;
    by_store: Record<string, LtoTotals>;
  };
  ingredients: {
    variance_high: IngredientRow[];
    variance_low: IngredientRow[];
    main: IngredientRow[];
    paper: IngredientRow[];
  };
  portioning: PortioningBlock & { by_store: Record<string, PortioningBlock> };
}

/* ══════════════════════════════════════════════════════════════════════
 *  orders (raw order tables)
 * ══════════════════════════════════════════════════════════════════════ */

export interface ChannelSplit {
  customers_total: number;
  customers_phone: number;
  customers_call_center: number;
  customers_drive_thru: number;
  customers_doordash: number;
  customers_ubereats: number;
  customers_grubhub: number;
  website_in_store: number;
  website_delivery: number;
  mobile_in_store: number;
  mobile_delivery: number;
  website_in_store_customers: number;
  website_delivery_customers: number;
  mobile_in_store_customers: number;
  mobile_delivery_customers: number;
}

export interface UpsellingBlock {
  /** Units per upsell key: crazy_bread, cookies, sauce, wings, beverages, crazy_puffs, bev_20oz, bev_2l, italian_cheese_bread, pizza_base, "EMB Cheese", "EMB Pepperoni". */
  units: Record<string, number>;
  total_units: number;
  /** Weighted points per item. */
  score: Record<string, number>;
  total_score: number;
}

export interface PromoRow {
  modification_reason: string;
  promo_sales: number;
  doordash_sales: number;
  ubereats_sales: number;
  grubhub_sales: number;
  lc_sales: number;
  pct_of_store_sales: number;
}

export interface PromoTotals {
  total_promo_sales: number;
  total_doordash: number;
  total_ubereats: number;
  total_grubhub: number;
  total_lc: number;
  pct_of_store_sales: number;
}

export interface OrdersSection {
  meta: ReportMeta;
  channels: { totals: ChannelSplit; by_store: Record<string, ChannelSplit> };
  important_items_hnr: {
    totals: HnrTotals;
    by_store: Record<string, HnrTotals>;
    by_week: Array<ReportWeek & HnrTotals>;
    by_store_week: Record<string, Record<string, HnrTotals>>;
  };
  upselling: UpsellingBlock & { by_store: Record<string, UpsellingBlock> };
  promo: {
    total_store_sales: number;
    promo_breakdown: PromoRow[];
    promo_totals: PromoTotals;
    by_store: Array<{ store: string } & PromoTotals>;
  };
}

/* ══════════════════════════════════════════════════════════════════════
 *  quality
 * ══════════════════════════════════════════════════════════════════════ */

export interface CleaningScore {
  total: number;
  passes: number;
  overall_score: number;
}

export interface CustomerServiceAverages {
  entries: number;
  guest_service: number | null;
  /** Minutes, lower is better. */
  lobby_points: number | null;
  drive_thru_points: number | null;
}

export interface QualitySection {
  meta: ReportMeta;
  cleaning_review: CleaningScore & {
    by_store: Record<string, CleaningScore>;
    by_place: Array<{ review_place: string } & CleaningScore>;
  };
  customer_service: CustomerServiceAverages & {
    by_store: Record<string, CustomerServiceAverages>;
  };
}

/* ══════════════════════════════════════════════════════════════════════
 *  debriefs
 * ══════════════════════════════════════════════════════════════════════ */

export interface DebriefType {
  id: number | null;
  slug: string;
  label: string;
}

export interface DebriefTypeCount {
  type: DebriefType;
  count: number;
}

export interface DebriefsSection {
  meta: ReportMeta;
  debrief_types: DebriefType[];
  summary: {
    active_employees: number;
    inactive_employees: number;
    total_debriefs: number;
    most_common_type: DebriefType | null;
    avg_weekly_debriefs: number | null;
  };
  by_type: DebriefTypeCount[];
  weeks: Array<{ week_start: string; week_end: string; total_count: number; by_type: DebriefTypeCount[] }>;
  by_store: Record<string, { active_employees: number; total_count: number; by_type: DebriefTypeCount[] }>;
  events: Array<{
    debrief_id: number;
    employee_id: number | null;
    employee_name: string | null;
    type: DebriefType | null;
    date: string;
    note: string | null;
    author: string | null;
    store: string;
  }>;
  employees: Array<{
    employee_id: number;
    name: string;
    store: string;
    active: boolean;
    debriefs: { total_count: number; by_type: DebriefTypeCount[] };
  }>;
}

/* ══════════════════════════════════════════════════════════════════════
 *  store-score
 * ══════════════════════════════════════════════════════════════════════ */

export interface StoreScoreWeek {
  /** The day the week was scored as of (the week's last day inside the range). */
  as_of: string;
  score: number;
  label: string;
  raw_score: number;
  non_negotiable: { entries: number; downtime: number; other: number; penalty: number };
  details: Array<{ key: string; label: string; score: number; max: number; actual_percent?: number | null }>;
}

export interface StoreScoreSection {
  meta: ReportMeta;
  by_store: Record<
    string,
    { average_score: number; average_label: string; weeks: Record<string, StoreScoreWeek> }
  >;
}

/* ══════════════════════════════════════════════════════════════════════
 *  Hiring  GET /v1/reports/labor — the Labor report, many stores, any range
 * ══════════════════════════════════════════════════════════════════════ */

export interface LaborTurnoverEvent {
  employee_id: number;
  name: string | null;
  store: string;
  type: "voluntary" | "involuntary";
  status?: string;
  effective_date: string;
  reason: string | null;
  reason_matched?: boolean;
  tenure_days: number | null;
  impact_snapshot?: {
    lookback_days: number;
    avg_weekly_hours: number | null;
    store_avg_weekly_hours_same_period: number | null;
    above_average_hours: boolean | null;
    avg_performance_score: number | null;
    store_avg_performance_score_same_period: number | null;
    above_average_performance: boolean | null;
    avg_hourly_pay: number | null;
  } | null;
}

export interface LaborOvertimeRow {
  employee_id: number;
  name: string | null;
  store: string;
  position: string | null;
  week_start: string;
  total_hours: number;
  overtime_hours: number;
}

export interface LaborColumnStats {
  label: string;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface LaborTrendWeek {
  week_start: string;
  week_end: string;
  headcount_active_end: number | null;
  total_hours: number | null;
  total_gross_pay: number | null;
  turnover_rate_percent: number | null;
  total_sales: number | null;
  average_performance_score: number | null;
  average_hourly_pay: number | null;
  average_labor_percent: number | null;
}

export interface LaborRosterRow {
  employee_id: number;
  name: string;
  store: string;
  position: string | null;
  status: string;
  hire_date: string | null;
  tenure_days: number | null;
  base_pay: string | null;
  performance_pay: string | null;
  birthday?: unknown;
  metrics: Record<string, { label: string; sum: number | null; avg: number | null }>;
}

export interface LaborBlock {
  summary: {
    headcount_start: number;
    headcount_end: number;
    new_hires: number;
    separations: number;
    notable_departures: number;
    turnover_rate_percent: number | null;
    avg_weekly_gross_pay: number | null;
    avg_weekly_hours: number | null;
    employee_weeks_over_40: number;
    employee_weeks_over_60: number;
  };
  headcount: {
    active_start: number;
    active_end: number;
    /** active_end − active_start (hires − separations + transfers in − out). */
    net_change: number;
    /** People who became active at these stores while active nowhere before. */
    new_hires: number;
    /** People who left these stores and are active nowhere after. */
    separations: number;
    /** Moved in from / out to a store outside the one counted. */
    transfers_in: number;
    transfers_out: number;
    by_position: Array<{ position: string; count: number }>;
  };
  tenure: {
    average_tenure_days: number | null;
    distribution: Array<{ bucket: string; count: number }>;
    newest_hires?: Array<{ employee_id: number; name: string; store: string; tenure_days: number }>;
    longest_tenured?: Array<{ employee_id: number; name: string; store: string; tenure_days: number }>;
  };
  turnover: {
    separations_count: number;
    voluntary_count: number;
    involuntary_count: number;
    turnover_rate_percent: number | null;
    by_reason: Array<{ reason: string; type: string; count: number }>;
    events?: LaborTurnoverEvent[];
  };
  overtime: {
    over_40_hours_threshold: number;
    over_60_hours_threshold: number;
    /** Employee-weeks over each line (present on every block). */
    over_40_count: number;
    over_60_count: number;
    over_40?: LaborOvertimeRow[];
    over_60?: LaborOvertimeRow[];
  };
  labor: {
    highlights: {
      total_hours: number | null;
      average_hourly_pay: number | null;
      total_gross_pay: number | null;
      average_gross_pay_per_employee: number | null;
      average_labor_percent: number | null;
      total_sales: number | null;
      total_tips: number | null;
      average_performance_score: number | null;
      average_final_score: number | null;
      [key: string]: number | null;
    };
    by_column: Record<string, LaborColumnStats>;
  };
  trend: LaborTrendWeek[];
  pay: {
    average_hourly_pay: number | null;
    maximum_hourly_pay: number | null;
    minimum_hourly_pay: number | null;
    total_tips: number | null;
    total_hours: number | null;
    tips_per_hour: number | null;
  };
  roster?: LaborRosterRow[];
  birthdays?: Array<{
    employee_id: number;
    name: string;
    store: string;
    position: string | null;
    birth_date: string;
    turns_age: number;
    date: string;
  }>;
}

export interface LaborReport {
  start_date: string;
  end_date: string;
  weeks: Array<{ week_start: string; week_end: string }>;
  /** All requested stores together; the only block with the lists. */
  combined: LaborBlock;
  by_store: Record<string, LaborBlock>;
}

/* ══════════════════════════════════════════════════════════════════════
 *  Hooks  GET /reports/wbr/bulk — feedback / complaints / money owed
 * ══════════════════════════════════════════════════════════════════════ */

export interface WbrBulkFeedback {
  id: number;
  external_entry_number: number;
  submitted_at: string;
  store_label: string;
  improvement_feedback: string;
  first_name: string;
  last_name: string;
  valued_respected_appreciated_rating: number;
  work_schedule_satisfaction_rating: number;
  created_at: string;
  updated_at: string;
}

export interface WbrBulkComplaint {
  id: number;
  external_entry_number: number;
  store_label: string;
  issue: string;
  suggestion: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  complaint_date: string;
  submitted_at: string;
  manager_informed: string;
  created_at: string;
  updated_at: string;
}

export interface WbrBulkMoneyOwed {
  id: number;
  form_id: string;
  store_label: string;
  store_manager_full_name: string;
  manager_consulted_full_name: string;
  employee_full_name: string;
  expense_date: string;
  expense_description: string;
  expenses_amount: string;
  group_manager_full_name: string;
  approve: string | null;
  notes: string | null;
  rejection_reason: string | null;
  bi_full_name: string | null;
  bi_approve: string | null;
  bi_notes: string | null;
  bi_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface WbrBulkStore {
  store_label: string;
  store_number: number;
  feedbacks: WbrBulkFeedback[];
  complaints: WbrBulkComplaint[];
  money_owed: WbrBulkMoneyOwed[];
}

export interface WbrBulkResponse {
  start_date: string;
  end_date: string;
  /** Sorted by store_number ascending. */
  stores: WbrBulkStore[];
}

/* ══════════════════════════════════════════════════════════════════════
 *  The page's data
 * ══════════════════════════════════════════════════════════════════════ */

/** Hiring: total payroll per store → week_start (store-weeks without payroll are absent). */
export interface PayrollWeeks {
  by_store: Record<string, Record<string, number>>;
}

export interface BusinessReportsData {
  sales: SalesSection;
  operations: OperationsSection;
  menu: MenuSection;
  orders: OrdersSection;
  quality: QualitySection;
  debriefs: DebriefsSection;
  storeScore: StoreScoreSection;
  labor: LaborReport;
  /** Payroll per store-week for final labor — its own small request, so labor never waits on `labor`. */
  payrollWeeks: PayrollWeeks;
  feedback: WbrBulkResponse;
  /** Maintenance analytics summary over the range (recurring issues, statuses, per store). */
  tickets: AnalyticsSummary;
  /** Operations: every active employee of the stores against every skill (a snapshot, not ranged). */
  skills: StoreSkillsOverview;
  /** V1's Sales History for the loaded stores together: every week since the first data (not the picked range). */
  salesHistory: SalesHistory;
}

export type SectionKey = keyof BusinessReportsData;

/** Why a section has no data: stopped by the user, too heavy for the range, no access, or another failure. */
export type SectionErrorKind = "stopped" | "too-big" | "no-access" | "failed";

/** One section's state: each loads, fails and renders on its own. */
export interface SectionState<T> {
  data: T | null;
  /** A short message for the user (never raw server output). */
  error: string | null;
  errorKind?: SectionErrorKind;
  loading: boolean;
}

export type BusinessReportsState = {
  [K in SectionKey]: SectionState<BusinessReportsData[K]>;
};
