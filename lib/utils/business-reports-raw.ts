/**
 * Shared row-builders for the Sales & Operations tab.
 *
 * These accept either the aggregate `DashboardTotals` (already numeric) or a
 * normalized raw per-store-per-day row (see `normalizeRow`), so the same
 * Channel Mix / Category Mix / Fulfillment / Tips & Cash / Portal & HNR
 * sections can be reused both for the top-level cards and for the per-cell
 * drill-down breakdown.
 */
import type { DashboardTotals, MultiDashboardDailyRow } from "@/types/business-reports.types";

export const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "pizza", label: "Pizza" },
  { key: "hnr", label: "HNR" },
  { key: "bread", label: "Bread" },
  { key: "wings", label: "Wings" },
  { key: "beverages", label: "Beverages" },
  { key: "other_foods", label: "Other Foods" },
  { key: "side_items", label: "Side Items" },
];

const CHANNELS: Array<{ label: string; salesKey: string; ordersKey: string }> = [
  { label: "Phone", salesKey: "phone_sales", ordersKey: "phone_orders" },
  { label: "Website", salesKey: "website_sales", ordersKey: "website_orders" },
  { label: "Mobile", salesKey: "mobile_sales", ordersKey: "mobile_orders" },
  { label: "Call Center", salesKey: "call_center_sales", ordersKey: "call_center_orders" },
  { label: "Drive-Thru", salesKey: "drive_thru_sales", ordersKey: "drive_thru_orders" },
  { label: "DoorDash", salesKey: "doordash_sales", ordersKey: "doordash_orders" },
  { label: "Uber Eats", salesKey: "ubereats_sales", ordersKey: "ubereats_orders" },
  { label: "Grubhub", salesKey: "grubhub_sales", ordersKey: "grubhub_orders" },
];

export const toNum = (v: string | number | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const p = parseFloat(v);
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
};

/** Coerce a raw per-day row (string|number|null values) into a fully-numeric record. */
export function normalizeRow(row: MultiDashboardDailyRow): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(row)) out[k] = toNum(v);
  return out;
}

type NumericTotals = Partial<DashboardTotals> | Record<string, number>;
const g = (t: NumericTotals, key: string): number => {
  const v = (t as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
};

export function buildChannelRows(t: NumericTotals): Array<[string, number, number]> {
  return CHANNELS.map(({ label, salesKey, ordersKey }) => [
    label,
    g(t, salesKey),
    g(t, ordersKey),
  ]);
}

export interface CategoryRow {
  label: string;
  dSales: number;
  cSales: number;
  total: number;
  qty: number;
}
export function buildCategoryRows(t: NumericTotals): CategoryRow[] {
  return CATEGORIES.map((c) => {
    const dSales = g(t, `${c.key}_delivery_sales`);
    const cSales = g(t, `${c.key}_carryout_sales`);
    const dQty = g(t, `${c.key}_delivery_quantity`);
    const cQty = g(t, `${c.key}_carryout_quantity`);
    return { label: c.label, dSales, cSales, total: dSales + cSales, qty: dQty + cQty };
  });
}

export function buildFulfillmentRows(t: NumericTotals) {
  const totalOrders = g(t, "total_orders");
  return {
    delivery: { orders: g(t, "delivery_orders"), sales: g(t, "delivery_sales") },
    carryout: { orders: g(t, "carryout_orders"), sales: g(t, "carryout_sales") },
    totalOrders,
  };
}

/** Two-column label/value rows, matching the "Tips & Cash" layout. */
export function buildTipsCashRows(t: NumericTotals): Array<[string, number, string, number]> {
  return [
    ["Delivery Tips", g(t, "delivery_tips"), "Store Tips", g(t, "store_tips")],
    ["Total Tips", g(t, "total_tips"), "Cash Sales", g(t, "cash_sales")],
    ["Sales Tax", g(t, "sales_tax"), "Delivery Fees", g(t, "delivery_fees")],
    ["Over / Short", g(t, "over_short"), "Refunds", g(t, "refund_amount")],
  ];
}

export function buildPortalHnrRows(t: NumericTotals): Array<[string, number, string, number]> {
  return [
    ["Portal Eligible", g(t, "portal_eligible_orders"), "Portal Used", g(t, "portal_used_orders")],
    ["On-Time Orders", g(t, "portal_on_time_orders"), "Digital Orders", g(t, "digital_orders")],
    ["Digital Sales", g(t, "digital_sales"), "HNR Transactions", g(t, "hnr_transactions")],
    ["HNR Broken Promises", g(t, "hnr_broken_promises"), "Completed Orders", g(t, "completed_orders")],
  ];
}

export function buildOrderQualityRows(t: NumericTotals): Array<[string, number, string, number]> {
  return [
    ["Royalty Obligation", g(t, "royalty_obligation"), "Cancelled Orders", g(t, "cancelled_orders")],
    ["Modified Orders", g(t, "modified_orders"), "Refunded Orders", g(t, "refunded_orders")],
  ];
}

export function coreMetrics(t: NumericTotals) {
  const gross = g(t, "gross_sales");
  const net = g(t, "net_sales");
  const orders = g(t, "total_orders");
  const customers = g(t, "customer_count");
  return { gross, net, orders, customers, aov: orders ? gross / orders : 0 };
}
