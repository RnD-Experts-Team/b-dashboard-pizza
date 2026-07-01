/**
 * Business Reports Types
 *
 * Response shapes for the three multi-store, date-range bulk endpoints
 * consolidated on the Business Reports page:
 *   1. Sales / Ops   → POST /api/reports/multi-dashboard
 *   2. Labor / Staff → GET  /api/v1/reports
 *   3. Feedback      → GET  /api/reports/wbr/bulk
 *
 * Shapes mirror the upstream API specs exactly (snake_case, hyphenated keys).
 */

/* ══════════════════════════════════════════════════════════════════════
 *  Shared
 * ══════════════════════════════════════════════════════════════════════ */

/** Store selection: an explicit list of store identifiers, or every store. */
export type StoreSelection = string[] | "all";

/** Common request parameters shared by all three endpoints. */
export interface BusinessReportsParams {
  /** YYYY-MM-DD (inclusive) */
  startDate: string;
  /** YYYY-MM-DD (inclusive) */
  endDate: string;
  stores: StoreSelection;
}

/* ══════════════════════════════════════════════════════════════════════
 *  1. Multi-Dashboard  (POST /api/reports/multi-dashboard)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Flat aggregated metric block. Appears at the top level (`totals`), per-store
 * (`by_store[id].totals`), and per-date (`by_date[date].totals`). All money and
 * count fields are numbers; treat missing as 0.
 *
 * The rate fields (avg_order_value, *_rate, digital_penetration) are present on
 * the top-level and per-date `totals`, but NOT on per-store `totals` — for
 * per-store rates read `MultiDashboardStoreBlock.averages` instead. Hence they
 * are optional here.
 */
export interface DashboardTotals {
  gross_sales: number;
  royalty_obligation: number;
  net_sales: number;
  refund_amount: number;

  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  modified_orders: number;
  refunded_orders: number;
  customer_count: number;

  // Channels (orders + sales)
  phone_orders: number;
  phone_sales: number;
  website_orders: number;
  website_sales: number;
  mobile_orders: number;
  mobile_sales: number;
  call_center_orders: number;
  call_center_sales: number;
  drive_thru_orders: number;
  drive_thru_sales: number;
  doordash_orders: number;
  doordash_sales: number;
  ubereats_orders: number;
  ubereats_sales: number;
  grubhub_orders: number;
  grubhub_sales: number;

  // Fulfillment split
  delivery_orders: number;
  delivery_sales: number;
  carryout_orders: number;
  carryout_sales: number;

  // Product category × fulfillment (quantity + sales)
  pizza_delivery_quantity: number;
  pizza_delivery_sales: number;
  pizza_carryout_quantity: number;
  pizza_carryout_sales: number;
  hnr_delivery_quantity: number;
  hnr_delivery_sales: number;
  hnr_carryout_quantity: number;
  hnr_carryout_sales: number;
  bread_delivery_quantity: number;
  bread_delivery_sales: number;
  bread_carryout_quantity: number;
  bread_carryout_sales: number;
  wings_delivery_quantity: number;
  wings_delivery_sales: number;
  wings_carryout_quantity: number;
  wings_carryout_sales: number;
  beverages_delivery_quantity: number;
  beverages_delivery_sales: number;
  beverages_carryout_quantity: number;
  beverages_carryout_sales: number;
  other_foods_delivery_quantity: number;
  other_foods_delivery_sales: number;
  other_foods_carryout_quantity: number;
  other_foods_carryout_sales: number;
  side_items_delivery_quantity: number;
  side_items_delivery_sales: number;
  side_items_carryout_quantity: number;
  side_items_carryout_sales: number;

  // Money / cash
  sales_tax: number;
  delivery_fees: number;
  delivery_tips: number;
  store_tips: number;
  total_tips: number;
  cash_sales: number;
  over_short: number;

  // Portal / digital / HNR
  portal_eligible_orders: number;
  portal_used_orders: number;
  portal_on_time_orders: number;
  digital_orders: number;
  digital_sales: number;
  hnr_transactions: number;
  hnr_broken_promises: number;

  labor_total: number;

  // Rates — present on top-level & per-date totals only (optional).
  avg_order_value?: number;
  portal_usage_rate?: number;
  portal_on_time_rate?: number;
  digital_penetration?: number;
  delivery_rate?: number;
}

/** Averages block — where per-store rate metrics actually live. */
export interface DashboardAverages {
  gross_sales_per_store_per_day: number;
  royalty_obligation_per_store_per_day?: number;
  net_sales_per_store_per_day?: number;
  orders_per_store_per_day?: number;
  customer_count_per_store_per_day?: number;
  avg_order_value?: number;
  portal_usage_rate?: number;
  portal_on_time_rate?: number;
  digital_penetration?: number;
  delivery_rate?: number;
}

/** Supplemental per-store figures not part of the sales rollup. */
export interface DashboardSupplemental {
  labor_total: number;
  transfers_in_cost?: number;
  transfers_out_cost?: number;
  non_negotiable_count?: number;
  go_to_calls?: unknown[];
}

/** Raw per-day store row (numeric fields arrive as strings). Not rendered directly. */
export type MultiDashboardDailyRow = Record<string, string | number | null>;

/** One store's block inside `by_store`. */
export interface MultiDashboardStoreBlock {
  totals: DashboardTotals;
  averages: DashboardAverages;
  supplemental: DashboardSupplemental;
  /** Per-day rows for this store, keyed by YYYY-MM-DD (raw string values). */
  by_date: Record<string, MultiDashboardDailyRow>;
}

/** One date's block inside `by_date`. */
export interface MultiDashboardDateBlock {
  totals: DashboardTotals;
  /** Per-store raw rows for this date, keyed by store number. */
  by_store: Record<string, MultiDashboardDailyRow>;
}

export interface MultiDashboardMeta {
  start_date: string;
  end_date: string;
  total_days: number;
  stores: string[];
  store_count: number;
}

export interface MultiDashboardResponse {
  meta?: MultiDashboardMeta;
  totals: DashboardTotals;
  averages: DashboardAverages;
  /** Keyed by store number, e.g. "03795-00001". */
  by_store: Record<string, MultiDashboardStoreBlock>;
  /** Keyed by date, e.g. "2026-06-25". */
  by_date: Record<string, MultiDashboardDateBlock>;
}

/* ══════════════════════════════════════════════════════════════════════
 *  2. V1 Reports  (GET /api/v1/reports) — labor & employees
 * ══════════════════════════════════════════════════════════════════════ */

export interface V1EmployeeName {
  first: string;
  middle: string | null;
  last: string;
}

export type V1Birthday =
  | {
      is_upcoming: true;
      birth_date: string;
      days_until: number;
      turns_age: number;
    }
  | { is_upcoming: false };

export interface V1EmployeeMetric {
  metric_date: string;
  label: string;
  value: string;
  value_numeric: number;
}

export interface V1ManagerEmployee {
  employee_id: number;
  name: V1EmployeeName;
  status: "active" | "inactive";
  birthday: V1Birthday;
  position: string | null;
  base_pay: string | null;
  performance_pay: string | null;
  metrics: V1EmployeeMetric[];
}

export interface V1ManagerDashboardSection {
  store_id: string;
  start_date: string;
  end_date: string;
  employees: V1ManagerEmployee[];
}

export interface V1HighHoursEmployee {
  employee_id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  total_hours: number | null;
  hourly_pay: number | null;
  gross_pay: number | null;
}

export interface V1HighHoursSection {
  store: string;
  start_date: string;
  end_date: string;
  employees: V1HighHoursEmployee[];
}

export interface V1AverageHourlyPayEmployee {
  employee_id: number;
  first_name: string;
  last_name: string;
  hourly_pay: number | null;
  total_hours: number | null;
  tips: number | null;
  /** Labor % × 100 (e.g. 28.5 = 28.5%). */
  labor: number | null;
}

export interface V1AverageHourlyPaySection {
  store: string;
  start_date: string;
  end_date: string;
  employees: V1AverageHourlyPayEmployee[];
}

export interface V1WeeklyLaborEntry {
  /** Tuesday that starts the business week. */
  week_start: string;
  /** Monday that ends the business week. */
  week_end: string;
  /** Average labor % × 100 for the week, or null when no data. */
  labor: number | null;
}

export interface V1WeeklyLaborSection {
  store: string;
  entries: V1WeeklyLaborEntry[];
}

/** One store's four labor/employee sections. */
export interface V1StoreReport {
  "manager-dashboard": V1ManagerDashboardSection;
  "high-hours-employees": V1HighHoursSection;
  "average-hourly-pay": V1AverageHourlyPaySection;
  "weekly-labor": V1WeeklyLaborSection;
}

/** Top-level response — keyed by store number, e.g. "101". */
export type V1ReportsResponse = Record<string, V1StoreReport>;

/* ══════════════════════════════════════════════════════════════════════
 *  3. WBR Bulk  (GET /api/reports/wbr/bulk) — feedback / complaints / money
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
 *  Combined hook result
 * ══════════════════════════════════════════════════════════════════════ */

/** Per-domain error messages — a domain may fail while others succeed. */
export interface BusinessReportsErrors {
  sales: string | null;
  labor: string | null;
  feedback: string | null;
}

export interface BusinessReportsData {
  sales: MultiDashboardResponse | null;
  labor: V1ReportsResponse | null;
  feedback: WbrBulkResponse | null;
}
