"use client";

import { cn } from "@/lib/utils";
import {
  ReportCard,
  DataBar,
  TblWrap,
  TBL,
  TH,
  TD,
  NUM,
} from "@/components/wbr-reports/primitives";
import { fmt$, fmt$2, fmtNum, fmtPct } from "@/lib/mock/business-reports.mock";
import type {
  DashboardTotals,
  MultiDashboardResponse,
} from "@/types/business-reports.types";
import { TabEmpty, TabError } from "../states";

interface Props {
  data: MultiDashboardResponse | null;
  error: string | null;
}

const n = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

/** Product categories in the payload (each split by delivery/carryout). */
const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "pizza", label: "Pizza" },
  { key: "hnr", label: "HNR" },
  { key: "bread", label: "Bread" },
  { key: "wings", label: "Wings" },
  { key: "beverages", label: "Beverages" },
  { key: "other_foods", label: "Other Foods" },
  { key: "side_items", label: "Side Items" },
];

export function SalesOpsTab({ data, error }: Props) {
  if (error) return <TabError message={error} />;
  if (!data || !data.by_store || Object.keys(data.by_store).length === 0)
    return <TabEmpty message="No sales data for the selected range." />;

  const storeRows = Object.entries(data.by_store).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const dateRows = Object.entries(data.by_date ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const t = (data.totals ?? {}) as Partial<DashboardTotals>;
  const totalOrders = n(t.total_orders);

  const channels: Array<[string, number, number]> = [
    ["Phone", n(t.phone_sales), n(t.phone_orders)],
    ["Website", n(t.website_sales), n(t.website_orders)],
    ["Mobile", n(t.mobile_sales), n(t.mobile_orders)],
    ["Call Center", n(t.call_center_sales), n(t.call_center_orders)],
    ["Drive-Thru", n(t.drive_thru_sales), n(t.drive_thru_orders)],
    ["DoorDash", n(t.doordash_sales), n(t.doordash_orders)],
    ["Uber Eats", n(t.ubereats_sales), n(t.ubereats_orders)],
    ["Grubhub", n(t.grubhub_sales), n(t.grubhub_orders)],
  ];
  const channelMax = Math.max(1, ...channels.map(([, v]) => v));

  const catRows = CATEGORIES.map((c) => {
    const dSales = n(t[`${c.key}_delivery_sales` as keyof DashboardTotals] as number);
    const cSales = n(t[`${c.key}_carryout_sales` as keyof DashboardTotals] as number);
    const dQty = n(t[`${c.key}_delivery_quantity` as keyof DashboardTotals] as number);
    const cQty = n(t[`${c.key}_carryout_quantity` as keyof DashboardTotals] as number);
    return {
      label: c.label,
      dSales,
      cSales,
      total: dSales + cSales,
      qty: dQty + cQty,
    };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Per-store comparison */}
      <ReportCard
        title="Store Performance"
        hint={`${storeRows.length} store${storeRows.length === 1 ? "" : "s"}`}
        className="lg:col-span-2"
      >
        <TblWrap tall>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Store</th>
                <th className={cn(TH, NUM)}>Gross Sales</th>
                <th className={cn(TH, NUM)}>Net Sales</th>
                <th className={cn(TH, NUM)}>Orders</th>
                <th className={cn(TH, NUM)}>Customers</th>
                <th className={cn(TH, NUM)}>AOV</th>
                <th className={cn(TH, NUM)}>Portal %</th>
                <th className={cn(TH, NUM)}>On-Time %</th>
                <th className={cn(TH, NUM)}>Digital %</th>
                <th className={cn(TH, NUM)}>Delivery %</th>
                <th className={cn(TH, NUM)}>Labor</th>
              </tr>
            </thead>
            <tbody>
              {storeRows.map(([storeNum, block]) => {
                const bt = block.totals ?? ({} as Partial<DashboardTotals>);
                const ba = block.averages ?? {};
                return (
                  <tr key={storeNum}>
                    <td className={cn(TD, "font-semibold")}>{storeNum}</td>
                    <td className={cn(TD, NUM)}>{fmt$(bt.gross_sales)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(bt.net_sales)}</td>
                    <td className={cn(TD, NUM)}>{fmtNum(bt.total_orders)}</td>
                    <td className={cn(TD, NUM)}>{fmtNum(bt.customer_count)}</td>
                    <td className={cn(TD, NUM)}>{fmt$2(ba.avg_order_value)}</td>
                    <td className={cn(TD, NUM)}>{fmtPct(ba.portal_usage_rate)}</td>
                    <td className={cn(TD, NUM)}>{fmtPct(ba.portal_on_time_rate)}</td>
                    <td className={cn(TD, NUM)}>{fmtPct(ba.digital_penetration)}</td>
                    <td className={cn(TD, NUM)}>{fmtPct(ba.delivery_rate)}</td>
                    <td className={cn(TD, NUM)}>
                      {fmt$(block.supplemental?.labor_total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Channel mix */}
      <ReportCard title="Channel Mix" hint="Sales by ordering channel">
        <div className="space-y-2.5 p-4">
          {channels.map(([label, sales, orders]) => (
            <div key={label} className="flex items-center gap-3 text-[12.5px]">
              <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
              <span className="flex-1">
                <DataBar pct={(sales / channelMax) * 100} />
              </span>
              <span className="w-14 shrink-0 text-end tabular-nums text-muted-foreground">
                {fmtNum(orders)}
              </span>
              <span className="w-24 shrink-0 text-end tabular-nums">
                {fmt$(sales)}
              </span>
            </div>
          ))}
        </div>
      </ReportCard>

      {/* Fulfillment split */}
      <ReportCard title="Fulfillment Split" hint="Delivery vs Carryout">
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Type</th>
                <th className={cn(TH, NUM)}>Orders</th>
                <th className={cn(TH, NUM)}>Sales</th>
                <th className={cn(TH, NUM)}>Share</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={cn(TD, "font-semibold")}>Delivery</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.delivery_orders)}</td>
                <td className={cn(TD, NUM)}>{fmt$(t.delivery_sales)}</td>
                <td className={cn(TD, NUM)}>
                  {fmtPct(
                    totalOrders ? (n(t.delivery_orders) / totalOrders) * 100 : 0,
                  )}
                </td>
              </tr>
              <tr>
                <td className={cn(TD, "font-semibold")}>Carryout</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.carryout_orders)}</td>
                <td className={cn(TD, NUM)}>{fmt$(t.carryout_sales)}</td>
                <td className={cn(TD, NUM)}>
                  {fmtPct(
                    totalOrders ? (n(t.carryout_orders) / totalOrders) * 100 : 0,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Product category mix */}
      <ReportCard
        title="Product Category Mix"
        hint="Sales by category × fulfillment"
        className="lg:col-span-2"
      >
        <TblWrap>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Category</th>
                <th className={cn(TH, NUM)}>Delivery $</th>
                <th className={cn(TH, NUM)}>Carryout $</th>
                <th className={cn(TH, NUM)}>Total $</th>
                <th className={cn(TH, NUM)}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map((c) => (
                <tr key={c.label}>
                  <td className={cn(TD, "font-semibold")}>{c.label}</td>
                  <td className={cn(TD, NUM)}>{fmt$(c.dSales)}</td>
                  <td className={cn(TD, NUM)}>{fmt$(c.cSales)}</td>
                  <td className={cn(TD, NUM)}>{fmt$(c.total)}</td>
                  <td className={cn(TD, NUM)}>{fmtNum(c.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Tips & cash control */}
      <ReportCard title="Tips & Cash" hint="Tips, cash and reconciliation">
        <TblWrap>
          <table className={TBL}>
            <tbody>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Delivery Tips</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.delivery_tips)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Store Tips</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.store_tips)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Total Tips</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.total_tips)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Cash Sales</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.cash_sales)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Sales Tax</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.sales_tax)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Delivery Fees</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.delivery_fees)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Over / Short</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.over_short)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Refunds</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.refund_amount)}</td>
              </tr>
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Portal / digital / HNR operations */}
      <ReportCard title="Portal & HNR Operations" hint="Fulfillment quality">
        <TblWrap>
          <table className={TBL}>
            <tbody>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Portal Eligible</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.portal_eligible_orders)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Portal Used</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.portal_used_orders)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>On-Time Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.portal_on_time_orders)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Digital Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.digital_orders)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Digital Sales</td>
                <td className={cn(TD, NUM)}>{fmt$(t.digital_sales)}</td>
                <td className={cn(TD, "text-muted-foreground")}>HNR Transactions</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.hnr_transactions)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>HNR Broken Promises</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.hnr_broken_promises)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Completed Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.completed_orders)}</td>
              </tr>
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Daily trend */}
      <ReportCard
        title="Daily Trend"
        hint={`${dateRows.length} day${dateRows.length === 1 ? "" : "s"}`}
        className="lg:col-span-2"
      >
        <TblWrap tall>
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={cn(TH, NUM)}>Gross Sales</th>
                <th className={cn(TH, NUM)}>Net Sales</th>
                <th className={cn(TH, NUM)}>Orders</th>
                <th className={cn(TH, NUM)}>Customers</th>
                <th className={cn(TH, NUM)}>AOV</th>
                <th className={cn(TH, NUM)}>Stores</th>
              </tr>
            </thead>
            <tbody>
              {dateRows.map(([date, block]) => {
                const dt = block.totals ?? ({} as Partial<DashboardTotals>);
                return (
                  <tr key={date}>
                    <td className={cn(TD, "font-semibold")}>{date}</td>
                    <td className={cn(TD, NUM)}>{fmt$(dt.gross_sales)}</td>
                    <td className={cn(TD, NUM)}>{fmt$(dt.net_sales)}</td>
                    <td className={cn(TD, NUM)}>{fmtNum(dt.total_orders)}</td>
                    <td className={cn(TD, NUM)}>{fmtNum(dt.customer_count)}</td>
                    <td className={cn(TD, NUM)}>{fmt$2(dt.avg_order_value)}</td>
                    <td className={cn(TD, NUM)}>
                      {Object.keys(block.by_store ?? {}).length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>
    </div>
  );
}
