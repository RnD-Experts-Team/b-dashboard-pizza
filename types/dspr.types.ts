/**
 * DSPR (Daily Store Performance Report) Types
 * Maps the API response from data.lcportal.cloud/api/reports/dspr
 */

// ============================================================================
// Filtering
// ============================================================================

export interface DsprFiltering {
  store: string;
  date: string;
  iso_week: number;
  week_start: string;
  week_end: string;
}

// ============================================================================
// Sales
// ============================================================================

/** Date string -> sales amount mapping */
export type DaySalesMap = Record<string, number>;

export interface DsprSales {
  this_week_by_day: DaySalesMap;
  previous_week_by_day: DaySalesMap;
  same_week_last_year_by_day: DaySalesMap;
  this_week_total?: number;
  previous_week_total?: number;
  same_week_last_year_total?: number;
}

// ============================================================================
// Top Items & Ingredients
// ============================================================================

export interface TopMenuItem {
  franchise_store: string;
  item_id: string;
  menu_item_name: string;
  gross_sales: number;
  quantity_sold: number;
}

export interface TopIngredient {
  ingredient_id: string;
  ingredient_description: string;
  actual_usage: number;
  variance_value?: number;
}

export interface UpsellingRecord {
  crazy_bread?: number;
  cookies?: number;
  sauce?: number;
  wings?: number;
  beverages?: number;
  crazy_puffs?: number;
  bev_20oz?: number;
  bev_2l?: number;
  italian_cheese_bread?: number;
  pizza_base?: number;
  [key: string]: number | undefined;
}

export interface DsprTop {
  top_5_items_sales_for_day: TopMenuItem[];
  top_5_items_sales_week_to_date?: TopMenuItem[];
  top_5_items_count_for_day?: TopMenuItem[];
  top_5_items_count_week_to_date?: TopMenuItem[];
  ingredients: {
    top_3_ingredients_used: TopIngredient[];
    top_5_ingredients_variance_high?: TopIngredient[];
    top_5_ingredients_variance_low?: TopIngredient[];
    main_5_ingredients_usage: TopIngredient[];
    top_paper_5_ingredients_usage: TopIngredient[];
  };
}

// ============================================================================
// Day Details
// ============================================================================

export interface HourlySalesChannel {
  hour: number;
  royalty_obligation: string;
  adjusted_royalty_obligation?: string | number;
  phone_sales: string;
  call_center_sales: string;
  drive_thru_sales: string;
  website_sales: string;
  mobile_sales: string;
  doordash_sales: string;
  ubereats_sales: string;
  grubhub_sales: string;
}

export interface DsprChannelSales {
  royalty_obligation: number | string;
  phone_sales: number | string;
  call_center_sales: number | string;
  drive_thru_sales: number | string;
  website_sales: number | string;
  mobile_sales: number | string;
  doordash_sales: number | string;
  ubereats_sales: number | string;
  grubhub_sales: number | string;
}

export interface DsprRefundedOrders {
  count: number;
  sales: number;
}

export interface DsprWaste {
  alta_inventory: number;
  normal: number;
}

export interface DsprHnr {
  hnr_transactions: number;
  hnr_broken_promises: number;
  hnr_promise_met: number;
  hnr_promise_met_percent: number;
}

export interface DsprPortal {
  portal_eligible_orders: number;
  portal_used_orders: number;
  portal_on_time_orders: number;
  put_into_portal_percent: number;
  in_portal_on_time_percent: number;
  week_to_date?: {
    portal_eligible_orders: number;
    portal_used_orders: number;
    portal_on_time_orders: number;
    put_into_portal_percent: number;
    in_portal_on_time_percent: number;
  };
}

export interface DsprDay {
  hourly_sales_and_channels: HourlySalesChannel[];
  hourly_sales_and_channels_week_to_date_avg?: HourlySalesChannel[];
  total_sales: DsprChannelSales;
  total_sales_week_to_date?: DsprChannelSales;
  total_sales_week_to_date_avg?: DsprChannelSales;
  total_cash_sales: number;
  total_cash_sales_week_to_date?: number;
  total_deposit: number;
  total_deposit_week_to_date?: number;
  over_short: number;
  over_short_week_to_date?: number;
  refunded_orders: DsprRefundedOrders;
  refunded_orders_week_to_date?: DsprRefundedOrders;
  customer_count: number;
  customer_count_week_to_date?: number;
  waste: DsprWaste;
  waste_week_to_date?: DsprWaste;
  total_tips: number;
  total_tips_week_to_date?: number;
  hnr: DsprHnr;
  hnr_week_to_date?: DsprHnr;
  labor: number;
  labor_week_to_date?: number;
  portal: DsprPortal;
  upselling?: {
    day: UpsellingRecord;
    week_to_date: UpsellingRecord;
  };
}

// ============================================================================
// Full DSPR Response
// ============================================================================

export interface DsprResponse {
  filtering: DsprFiltering;
  sales: DsprSales;
  top: DsprTop;
  day: DsprDay;
}
