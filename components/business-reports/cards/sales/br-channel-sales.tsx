"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { useSection } from "@/components/business-reports/report-context";
import { fmt$, fmtNum, fmtPct, share } from "@/components/business-reports/report-format";
import type { ChannelKey, ChannelSplit, SalesMetrics, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrChannelSalesCard — V1 "Channel Sales" over the range: sales and orders
 *  per channel (sales section) plus customers and the website/mobile
 *  in-store vs delivery split (orders section). Renders on sales alone; the
 *  orders-only cells fill in when the orders section lands.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_CHANNEL_SALES_SPAN: V1Span = 2;

interface RowDef {
  key: string;
  label: string;
  /** Sales from the sales section, or null when it comes from the orders split. */
  sales: (t: SalesMetrics) => number | null;
  splitSales?: (s: ChannelSplit) => number;
  orders: (t: SalesMetrics) => number | null;
  customers: (s: ChannelSplit) => number | null;
  bold?: boolean;
  indent?: boolean;
}

const channelRow = (ch: ChannelKey, label: string, customers: (s: ChannelSplit) => number | null): RowDef => ({
  key: ch,
  label,
  sales: (t) => t[`${ch}_sales`],
  orders: (t) => t[`${ch}_orders`],
  customers,
});

const ROWS: RowDef[] = [
  channelRow("phone", "Phone", (s) => s.customers_phone),
  {
    ...channelRow("website", "Website", (s) => s.website_in_store_customers + s.website_delivery_customers),
    bold: true,
  },
  {
    key: "website_in_store",
    label: "In-store",
    sales: () => null,
    splitSales: (s) => s.website_in_store,
    orders: () => null,
    customers: (s) => s.website_in_store_customers,
    indent: true,
  },
  {
    key: "website_delivery",
    label: "Delivery",
    sales: () => null,
    splitSales: (s) => s.website_delivery,
    orders: () => null,
    customers: (s) => s.website_delivery_customers,
    indent: true,
  },
  {
    ...channelRow("mobile", "Mobile", (s) => s.mobile_in_store_customers + s.mobile_delivery_customers),
    bold: true,
  },
  {
    key: "mobile_in_store",
    label: "In-store",
    sales: () => null,
    splitSales: (s) => s.mobile_in_store,
    orders: () => null,
    customers: (s) => s.mobile_in_store_customers,
    indent: true,
  },
  {
    key: "mobile_delivery",
    label: "Delivery",
    sales: () => null,
    splitSales: (s) => s.mobile_delivery,
    orders: () => null,
    customers: (s) => s.mobile_delivery_customers,
    indent: true,
  },
  channelRow("call_center", "Call Center", (s) => s.customers_call_center),
  channelRow("drive_thru", "Drive-Thru", (s) => s.customers_drive_thru),
  channelRow("doordash", "DoorDash", (s) => s.customers_doordash),
  channelRow("ubereats", "UberEats", (s) => s.customers_ubereats),
  channelRow("grubhub", "Grubhub", (s) => s.customers_grubhub),
  {
    key: "register",
    label: "Register",
    sales: (t) => t.register_sales,
    orders: () => null,
    customers: () => null,
    bold: true,
  },
];

interface CellRow {
  key: string;
  label: string;
  sales: number | null;
  orders: number | null;
  customers: number | null;
  bold?: boolean;
  indent?: boolean;
}

export function BrChannelSalesCard({ data }: { data: SalesSection }) {
  const orders = useSection("orders");
  const split = orders.data?.channels.totals ?? null;
  const pending = orders.loading && !split;
  const t = data.totals;

  const rows = useMemo<CellRow[]>(
    () =>
      ROWS.map((r) => ({
        key: r.key,
        label: r.label,
        sales: r.sales(t) ?? (split && r.splitSales ? r.splitSales(split) : null),
        orders: r.orders(t),
        customers: split ? r.customers(split) : null,
        bold: r.bold,
        indent: r.indent,
      })),
    [t, split],
  );

  const placeholder = pending ? (
    <Loader2 className="ms-auto h-3 w-3 animate-spin text-muted-foreground" aria-label="Loading" />
  ) : (
    <span className="text-muted-foreground">—</span>
  );

  return (
    <V1Card
      title="Channel Sales"
      category="sales"
      period="R"
      span={BR_CHANNEL_SALES_SPAN}
      bodyClassName="px-0"
      headerNote={orders.error ? "Customer split unavailable" : undefined}
    >
      <table className={V1_TBL}>
        <thead>
          <tr>
            <th className={V1_TH}>Channel</th>
            <th className={cn(V1_TH, V1_NUM)}>Sales</th>
            <th className={cn(V1_TH, V1_NUM)}>Orders</th>
            <th className={cn(V1_TH, V1_NUM)}>Customers</th>
            <th className={cn(V1_TH, V1_NUM)}>Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={cn(V1_TD, r.indent && "ps-5 text-muted-foreground", r.bold && "font-semibold")}>
                {r.label}
              </td>
              <td className={cn(V1_TD, V1_NUM, r.bold && "font-semibold")}>
                {r.sales === null ? placeholder : fmt$(r.sales)}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                {r.orders === null ? <span className="text-muted-foreground">—</span> : fmtNum(r.orders)}
              </td>
              <td className={cn(V1_TD, V1_NUM)}>
                {r.customers === null ? placeholder : fmtNum(r.customers)}
              </td>
              <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                {r.sales === null ? "—" : fmtPct(share(r.sales, t.sales))}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={V1_TD}>Total</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmt$(t.sales)}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtNum(t.total_orders)}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtNum(t.customer_count)}</td>
            <td className={cn(V1_TD, V1_NUM)}>{fmtPct(share(t.sales, t.sales))}</td>
          </tr>
        </tbody>
      </table>
    </V1Card>
  );
}
