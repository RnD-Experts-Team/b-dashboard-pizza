"use client";

import { Fragment } from "react";
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
import {
  CATEGORIES,
  buildChannelRows,
  buildCategoryRows,
  buildFulfillmentRows,
  buildTipsCashRows,
  buildPortalHnrRows,
  buildOrderQualityRows,
  normalizeRow,
  coreMetrics,
} from "@/lib/utils/business-reports-raw";
import type {
  DashboardAverages,
  DashboardTotals,
  MultiDashboardDailyRow,
  MultiDashboardResponse,
} from "@/types/business-reports.types";
import { TabEmpty, TabError } from "../states";
import { ExpandChevronButton, useExpandedRows } from "../expandable-row";
import { CATEGORIES as REPORT_COLORS } from "@/components/dashboard-v1/category";

interface Props {
  data: MultiDashboardResponse | null;
  error: string | null;
}

const n = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

/* ── Full field-by-field breakdown for a single store-day cell ─────────
 * Reused both for the per-store daily drill-down and the per-date store
 * drill-down, since both bottom out at the same raw row shape. */
function CellBreakdown({ row }: { row: Record<string, number> }) {
  const channels = buildChannelRows(row);
  const channelMax = Math.max(1, ...channels.map(([, v]) => v));
  const catRows = buildCategoryRows(row);
  const { delivery, carryout, totalOrders } = buildFulfillmentRows(row);
  const tipsCash = buildTipsCashRows(row);
  const portalHnr = buildPortalHnrRows(row);
  const orderQuality = buildOrderQualityRows(row);

  return (
    <div className="grid gap-3 rounded-md border bg-card p-3 md:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Channel Mix
        </p>
        <p className="mb-1.5 text-[9.5px] text-muted-foreground">
          Bar length = sales vs. top channel
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="w-20 shrink-0">Channel</span>
            <span className="flex-1">Share</span>
            <span className="w-10 shrink-0 text-end">Orders</span>
            <span className="w-16 shrink-0 text-end">Sales</span>
          </div>
          {channels.map(([label, sales, orders]) => (
            <div key={label} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
              <span className="flex-1">
                <DataBar pct={(sales / channelMax) * 100} />
              </span>
              <span className="w-10 shrink-0 text-end tabular-nums text-muted-foreground">
                {fmtNum(orders)}
              </span>
              <span className="w-16 shrink-0 text-end tabular-nums">{fmt$(sales)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Category Mix
        </p>
        <table className={TBL}>
          <thead>
            <tr>
              <th className={cn(TH, "static")}>Category</th>
              <th className={cn(TH, NUM, "static")}>Total $</th>
              <th className={cn(TH, NUM, "static")}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {catRows.map((c) => (
              <tr key={c.label}>
                <td className={TD}>{c.label}</td>
                <td className={cn(TD, NUM)}>{fmt$(c.total)}</td>
                <td className={cn(TD, NUM)}>{fmtNum(c.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fulfillment
        </p>
        <table className={TBL}>
          <tbody>
            <tr>
              <td className={TD}>Delivery</td>
              <td className={cn(TD, NUM)}>{fmtNum(delivery.orders)}</td>
              <td className={cn(TD, NUM)}>{fmt$(delivery.sales)}</td>
              <td className={cn(TD, NUM)}>
                {fmtPct(totalOrders ? (delivery.orders / totalOrders) * 100 : 0)}
              </td>
            </tr>
            <tr>
              <td className={TD}>Carryout</td>
              <td className={cn(TD, NUM)}>{fmtNum(carryout.orders)}</td>
              <td className={cn(TD, NUM)}>{fmt$(carryout.sales)}</td>
              <td className={cn(TD, NUM)}>
                {fmtPct(totalOrders ? (carryout.orders / totalOrders) * 100 : 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tips, Cash &amp; Quality
        </p>
        <table className={TBL}>
          <tbody>
            {tipsCash.map(([l1, v1, l2, v2]) => (
              <tr key={l1}>
                <td className={cn(TD, "text-muted-foreground")}>{l1}</td>
                <td className={cn(TD, NUM)}>{fmt$2(v1)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{l2}</td>
                <td className={cn(TD, NUM)}>{fmt$2(v2)}</td>
              </tr>
            ))}
            {orderQuality.map(([l1, v1, l2, v2]) => (
              <tr key={l1}>
                <td className={cn(TD, "text-muted-foreground")}>{l1}</td>
                <td className={cn(TD, NUM)}>
                  {l1 === "Royalty Obligation" ? fmt$2(v1) : fmtNum(v1)}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>{l2}</td>
                <td className={cn(TD, NUM)}>{fmtNum(v2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:col-span-2">
        <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Portal &amp; HNR
        </p>
        <table className={TBL}>
          <tbody>
            {portalHnr.map(([l1, v1, l2, v2]) => (
              <tr key={l1}>
                <td className={cn(TD, "text-muted-foreground")}>{l1}</td>
                <td className={cn(TD, NUM)}>{l1 === "Digital Sales" ? fmt$(v1) : fmtNum(v1)}</td>
                <td className={cn(TD, "text-muted-foreground")}>{l2}</td>
                <td className={cn(TD, NUM)}>{fmtNum(v2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Per-store daily breakdown (Store Performance row drill-down) ──────── */
function StoreDailyBreakdown({ byDate }: { byDate: Record<string, MultiDashboardDailyRow> }) {
  const { isExpanded, toggle } = useExpandedRows();
  const rows = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));

  if (rows.length === 0)
    return <p className="p-3 text-xs text-muted-foreground">No daily breakdown available.</p>;

  return (
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
          </tr>
        </thead>
        <tbody>
          {rows.map(([date, raw]) => {
            const row = normalizeRow(raw);
            const m = coreMetrics(row);
            const open = isExpanded(date);
            return (
              <Fragment key={date}>
                <tr>
                  <td className={cn(TD, "font-semibold")}>
                    <ExpandChevronButton expanded={open} onClick={() => toggle(date)} />
                    {date}
                  </td>
                  <td className={cn(TD, NUM)}>{fmt$(m.gross)}</td>
                  <td className={cn(TD, NUM)}>{fmt$(m.net)}</td>
                  <td className={cn(TD, NUM)}>{fmtNum(m.orders)}</td>
                  <td className={cn(TD, NUM)}>{fmtNum(m.customers)}</td>
                  <td className={cn(TD, NUM)}>{fmt$2(m.aov)}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} className="bg-muted/20 p-2">
                      <CellBreakdown row={row} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TblWrap>
  );
}

/* ── Per-date store breakdown (Daily Trend row drill-down) ──────────────── */
function DateStoreBreakdown({ byStore }: { byStore: Record<string, MultiDashboardDailyRow> }) {
  const { isExpanded, toggle } = useExpandedRows();
  const rows = Object.entries(byStore).sort(([a], [b]) => a.localeCompare(b));

  if (rows.length === 0)
    return <p className="p-3 text-xs text-muted-foreground">No store breakdown available.</p>;

  return (
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
          </tr>
        </thead>
        <tbody>
          {rows.map(([storeNum, raw]) => {
            const row = normalizeRow(raw);
            const m = coreMetrics(row);
            const open = isExpanded(storeNum);
            return (
              <Fragment key={storeNum}>
                <tr>
                  <td className={cn(TD, "font-semibold")}>
                    <ExpandChevronButton expanded={open} onClick={() => toggle(storeNum)} />
                    {storeNum}
                  </td>
                  <td className={cn(TD, NUM)}>{fmt$(m.gross)}</td>
                  <td className={cn(TD, NUM)}>{fmt$(m.net)}</td>
                  <td className={cn(TD, NUM)}>{fmtNum(m.orders)}</td>
                  <td className={cn(TD, NUM)}>{fmtNum(m.customers)}</td>
                  <td className={cn(TD, NUM)}>{fmt$2(m.aov)}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={6} className="bg-muted/20 p-2">
                      <CellBreakdown row={row} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TblWrap>
  );
}

export function SalesOpsTab({ data, error }: Props) {
  const storeExpand = useExpandedRows();
  const dateExpand = useExpandedRows();

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
  const avg = (data.averages ?? {}) as Partial<DashboardAverages>;
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
        hint={`${storeRows.length} store${storeRows.length === 1 ? "" : "s"} · click a row to expand daily detail`}
        className="lg:col-span-2"
        accent={REPORT_COLORS.sales}
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
                <th className={cn(TH, NUM)}>Transfers In</th>
                <th className={cn(TH, NUM)}>Transfers Out</th>
                <th className={cn(TH, NUM)}>Non-Neg.</th>
                <th className={cn(TH, NUM)}>Go-To Calls</th>
              </tr>
            </thead>
            <tbody>
              {storeRows.map(([storeNum, block]) => {
                const bt = block.totals ?? ({} as Partial<DashboardTotals>);
                const ba = block.averages ?? {};
                const supp = block.supplemental ?? {};
                const open = storeExpand.isExpanded(storeNum);
                return (
                  <Fragment key={storeNum}>
                    <tr>
                      <td className={cn(TD, "font-semibold")}>
                        <ExpandChevronButton
                          expanded={open}
                          onClick={() => storeExpand.toggle(storeNum)}
                        />
                        {storeNum}
                      </td>
                      <td className={cn(TD, NUM)}>{fmt$(bt.gross_sales)}</td>
                      <td className={cn(TD, NUM)}>{fmt$(bt.net_sales)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(bt.total_orders)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(bt.customer_count)}</td>
                      <td className={cn(TD, NUM)}>{fmt$2(ba.avg_order_value)}</td>
                      <td className={cn(TD, NUM)}>{fmtPct(ba.portal_usage_rate)}</td>
                      <td className={cn(TD, NUM)}>{fmtPct(ba.portal_on_time_rate)}</td>
                      <td className={cn(TD, NUM)}>{fmtPct(ba.digital_penetration)}</td>
                      <td className={cn(TD, NUM)}>{fmtPct(ba.delivery_rate)}</td>
                      <td className={cn(TD, NUM)}>{fmt$(supp.labor_total)}</td>
                      <td className={cn(TD, NUM)}>{fmt$2(supp.transfers_in_cost)}</td>
                      <td className={cn(TD, NUM)}>{fmt$2(supp.transfers_out_cost)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(supp.non_negotiable_count)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(supp.go_to_calls?.length ?? 0)}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={15} className="bg-muted/10 p-2">
                          <StoreDailyBreakdown byDate={block.by_date ?? {}} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Channel mix */}
      <ReportCard
        title="Channel Mix"
        hint="Bar length = sales vs. top channel"
        accent={REPORT_COLORS.sales}
      >
        <div className="space-y-2.5 p-4">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="w-24 shrink-0">Channel</span>
            <span className="flex-1">Share of top channel</span>
            <span className="w-14 shrink-0 text-end">Orders</span>
            <span className="w-24 shrink-0 text-end">Sales</span>
          </div>
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
      <ReportCard
        title="Fulfillment Split"
        hint="Delivery vs Carryout"
        accent={REPORT_COLORS.operations}
      >
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
        accent={REPORT_COLORS.menu}
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
      <ReportCard
        title="Tips & Cash"
        hint="Tips, cash and reconciliation"
        accent={REPORT_COLORS.finance}
      >
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

      {/* Order quality & adjustments */}
      <ReportCard
        title="Order Quality & Adjustments"
        hint="Royalty, cancellations & modifications"
        accent={REPORT_COLORS.quality}
      >
        <TblWrap>
          <table className={TBL}>
            <tbody>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Royalty Obligation</td>
                <td className={cn(TD, NUM)}>{fmt$2(t.royalty_obligation)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Cancelled Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.cancelled_orders)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Modified Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.modified_orders)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Refunded Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(t.refunded_orders)}</td>
              </tr>
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Portal / digital / HNR operations */}
      <ReportCard
        title="Portal & HNR Operations"
        hint="Fulfillment quality"
        accent={REPORT_COLORS.operations}
      >
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

      {/* Per-store/day averages */}
      <ReportCard
        title="Per-Store/Day Averages"
        hint="Normalized across stores & days"
        accent={REPORT_COLORS.sales}
      >
        <TblWrap>
          <table className={TBL}>
            <tbody>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Gross Sales</td>
                <td className={cn(TD, NUM)}>{fmt$2(avg.gross_sales_per_store_per_day)}</td>
                <td className={cn(TD, "text-muted-foreground")}>Net Sales</td>
                <td className={cn(TD, NUM)}>{fmt$2(avg.net_sales_per_store_per_day)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Royalty Obligation</td>
                <td className={cn(TD, NUM)}>
                  {fmt$2(avg.royalty_obligation_per_store_per_day)}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>Orders</td>
                <td className={cn(TD, NUM)}>{fmtNum(avg.orders_per_store_per_day)}</td>
              </tr>
              <tr>
                <td className={cn(TD, "text-muted-foreground")}>Customers</td>
                <td className={cn(TD, NUM)} colSpan={3}>
                  {fmtNum(avg.customer_count_per_store_per_day)}
                </td>
              </tr>
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>

      {/* Daily trend */}
      <ReportCard
        title="Daily Trend"
        hint={`${dateRows.length} day${dateRows.length === 1 ? "" : "s"} · click a row to expand store detail`}
        className="lg:col-span-2"
        accent={REPORT_COLORS.sales}
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
                const open = dateExpand.isExpanded(date);
                return (
                  <Fragment key={date}>
                    <tr>
                      <td className={cn(TD, "font-semibold")}>
                        <ExpandChevronButton
                          expanded={open}
                          onClick={() => dateExpand.toggle(date)}
                        />
                        {date}
                      </td>
                      <td className={cn(TD, NUM)}>{fmt$(dt.gross_sales)}</td>
                      <td className={cn(TD, NUM)}>{fmt$(dt.net_sales)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(dt.total_orders)}</td>
                      <td className={cn(TD, NUM)}>{fmtNum(dt.customer_count)}</td>
                      <td className={cn(TD, NUM)}>{fmt$2(dt.avg_order_value)}</td>
                      <td className={cn(TD, NUM)}>
                        {Object.keys(block.by_store ?? {}).length}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} className="bg-muted/10 p-2">
                          <DateStoreBreakdown byStore={block.by_store ?? {}} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TblWrap>
      </ReportCard>
    </div>
  );
}
