/**
 * Types for the extra sections returned by:
 * GET /api/data/reports/dashboard/{store}/{date}
 *
 * The `dspr` section is typed separately in dspr.types.ts.
 * These types cover everything else in the response.
 */

// ============================================================================
// Shared
// ============================================================================

interface SalesPeriod {
  total_sales: number;
  customer_count: number;
}

// ============================================================================
// customer-count-and-sales
// ============================================================================

export interface CustomerCountAndSalesFiltering {
  store: string;
  date: string;
  fiscal_year: number;
  week_number: number;
  week_start: string;
  period_number: number;
  period_start: string;
  quarter_start: string;
  year_start: string;
}

export interface CustomerCountAndSales {
  filtering: CustomerCountAndSalesFiltering;
  week: {
    current: SalesPeriod;
    previous: SalesPeriod;
    same_week_last_year: SalesPeriod;
  };
  period: {
    current: SalesPeriod;
    previous: SalesPeriod;
    same_period_last_year: SalesPeriod;
  };
  quarter: {
    current: SalesPeriod;
    previous: SalesPeriod;
    same_quarter_last_year: SalesPeriod;
  };
  year: {
    current: SalesPeriod;
    previous: SalesPeriod;
  };
}

// ============================================================================
// portal-weekly
// ============================================================================

export interface PortalWeeklyRow {
  week_start: string;
  week_end: string;
  portal_eligible_orders: number;
  portal_used_orders: number;
  portal_on_time_orders: number;
  put_into_portal_percent: number;
  in_portal_on_time_percent: number;
  hnr_transactions: number;
  hnr_broken_promises: number;
  hnr_promise_met: number;
  hnr_promise_met_percent: number;
}

export interface PortalWeekly {
  filtering: {
    store: string;
    date: string;
    week_start: string;
    week_end: string;
  };
  weeks: PortalWeeklyRow[];
}

// ============================================================================
// channel-sales
// ============================================================================

export interface ChannelSalesBreakdown {
  in_store: number;
  delivery: number;
  total: number;
}

export interface ChannelSalesWeek {
  week_start: string;
  week_end: string;
  royalty_obligation: number;
  phone_sales: number;
  call_center_sales: number;
  drive_thru_sales: number;
  website_sales: ChannelSalesBreakdown;
  mobile_sales: ChannelSalesBreakdown;
  doordash_sales: number;
  ubereats_sales: number;
  grubhub_sales: number;
}

export interface ChannelSales {
  filtering: {
    store: string;
    date: string;
    week_start: string;
    week_end: string;
  };
  current_week: ChannelSalesWeek;
  previous_week: ChannelSalesWeek;
}

// ============================================================================
// phone-and-adjusted-sales
// ============================================================================

interface PhonePeriod {
  phone_sales: number;
  adjusted_royalty_obligation: number;
}

interface PhonePeriodSet {
  current: PhonePeriod;
  previous: PhonePeriod;
  same_week_last_year?: PhonePeriod;
  same_period_last_year?: PhonePeriod;
  same_quarter_last_year?: PhonePeriod;
}

export interface PhoneAndAdjustedSales {
  filtering: {
    store: string;
    date: string;
    fiscal_year: number;
    week_number: number;
    week_start: string;
    period_number: number;
    period_start: string;
    quarter_start: string;
    year_start: string;
  };
  week: PhonePeriodSet;
  period: PhonePeriodSet;
  quarter: PhonePeriodSet;
  year: PhonePeriodSet;
}

// ============================================================================
// cash-control
// ============================================================================

interface CashPeriod {
  cash_sales: number;
  deposit: number;
  deposit_minus_cash_sales: number;
  over_short: number;
  modified_orders?: number;
  refunded_orders?: number;
  voided_orders?: number;
}

export interface CashControl {
  filtering: {
    store: string;
    date: string;
    fiscal_year: number;
    week_start: string;
    period_number: number;
    period_start: string;
    quarter_start: string;
    year_start: string;
  };
  week: CashPeriod;
  period: CashPeriod;
  quarter: CashPeriod;
  year: CashPeriod;
}

// ============================================================================
// lto
// ============================================================================

export interface LtoItem {
  item_id: string;
  current_week_sales: number;
  current_week_quantity: number;
  previous_week_quantity: number;
  pct_of_store_sales: number;
  pct_of_store_quantity: number;
}

export interface Lto {
  filtering: {
    store: string;
    date: string;
    week_start: string;
    week_end: string;
  };
  store_totals: { total_sales: number; total_quantity: number };
  lto_totals: {
    total_sales: number;
    total_quantity: number;
    pct_of_store_sales: number;
    pct_of_store_quantity: number;
  };
  items: LtoItem[];
}

// ============================================================================
// promo
// ============================================================================

export interface PromoItem {
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

export interface PromoWeek {
  week_start?: string;
  week_end?: string;
  total_store_sales: number;
  promo_breakdown: PromoItem[];
  promo_totals: PromoTotals;
}

export interface Promo {
  filtering: {
    store: string;
    date: string;
    week_start: string;
    week_end: string;
  };
  current_week: PromoWeek;
  previous_week: PromoWeek;
  week_over_week: {
    promo_sales_change_pct: number;
    current_week_promo_to_sales_pct: number;
    previous_week_promo_to_sales_pct: number;
    promo_to_sales_pct_change: number;
  };
}

// ============================================================================
// go-to
// ============================================================================

export interface GoTo {
  filtering: {
    store: string;
    date: string;
    week_start: string;
    week_end: string;
  };
  summary: {
    total_calls: number;
    missed: number;
    is_store: number;
    is_store_manager: number;
    is_call_center: number;
  };
}

// ============================================================================
// Full extras envelope
// ============================================================================

export interface DashboardReportExtras {
  "customer-count-and-sales"?: CustomerCountAndSales;
  "portal-weekly"?: PortalWeekly;
  "channel-sales"?: ChannelSales;
  "phone-and-adjusted-sales"?: PhoneAndAdjustedSales;
  "cash-control"?: CashControl;
  lto?: Lto;
  promo?: Promo;
  "go-to"?: GoTo;
  "non-negotiable-reports"?: unknown[];
}
