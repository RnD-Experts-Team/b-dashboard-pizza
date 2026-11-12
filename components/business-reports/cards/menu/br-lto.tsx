"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { fmt$, fmt$2, fmtNum, fmtPct } from "@/components/business-reports/report-format";
import { BarList, Money, storeColumn, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { LtoTotals, MenuSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrLtoCard — V1 "Weekly LTO" over the range: limited-time-offer sales and
 *  quantity with their share of store totals, per item. Expand: the items
 *  ranked, the full item table, and every store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_LTO_SPAN: V1Span = 1;

type StoreRow = { store: string } & LtoTotals;
type ItemRow = MenuSection["lto"]["items"][number];

export function BrLtoCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
  const { lto_totals, items } = data.lto;

  return (
    <V1Card title="LTO" category="menu" period="R" span={BR_LTO_SPAN} onExpand={() => setOpen(true)}>
      <div className="space-y-2">
        <V1MetricGrid>
          <V1Metric label="LTO Sales" value={<Money value={lto_totals.total_sales} />} />
          <V1Metric label="LTO Qty" value={fmtNum(lto_totals.total_quantity)} />
          <V1Metric label="% of Store Sales" value={fmtPct(lto_totals.pct_of_store_sales)} />
          <V1Metric label="% of Store Qty" value={fmtPct(lto_totals.pct_of_store_quantity)} />
        </V1MetricGrid>

        {items.length === 0 ? (
          <V1Empty icon={Sparkles}>No LTO items in this range.</V1Empty>
        ) : (
          <table className={V1_TBL}>
            <thead>
              <tr>
                <th className={V1_TH}>Item</th>
                <th className={cn(V1_TH, V1_NUM)}>Sales</th>
                <th className={cn(V1_TH, V1_NUM)}>Qty</th>
                <th className={cn(V1_TH, V1_NUM)}>% Sales</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.item_id}>
                  <td className={cn(V1_TD, "max-w-[90px] truncate tabular-nums")} title={it.item_id}>
                    {it.item_id}
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    <Money value={it.sales} />
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmtNum(it.quantity)}</td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtPct(it.pct_of_store_sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <LtoDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

const ITEM_COLUMNS: PagedColumn<ItemRow>[] = [
  { key: "item", header: "Item", sortValue: (r) => r.item_id, render: (r) => <span className="font-semibold tabular-nums">{r.item_id}</span> },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$2(r.sales) },
  { key: "qty", header: "Qty", numeric: true, sortValue: (r) => r.quantity, render: (r) => fmtNum(r.quantity) },
  { key: "pct_sales", header: "% of store sales", numeric: true, sortValue: (r) => r.pct_of_store_sales, render: (r) => fmtPct(r.pct_of_store_sales) },
  {
    key: "pct_qty",
    header: "% of store qty",
    numeric: true,
    sortValue: (r) => r.pct_of_store_quantity,
    render: (r) => fmtPct(r.pct_of_store_quantity),
  },
];

function LtoDialog({ data, onClose }: { data: MenuSection; onClose: () => void }) {
  const { storeName, focusStore } = useReport();
  const { lto_totals, store_totals, items, by_store } = data.lto;

  const rows = useMemo<StoreRow[]>(() => Object.entries(by_store).map(([store, t]) => ({ ...t, store })), [by_store]);
  const bars = useMemo<BarRow[]>(
    () =>
      [...items]
        .sort((a, b) => b.sales - a.sales)
        .map((it) => ({
          key: it.item_id,
          label: it.item_id,
          value: it.sales,
          display: fmt$2(it.sales),
          sub: `${fmtNum(it.quantity)} sold · ${fmtPct(it.pct_of_store_sales)} of sales`,
        })),
    [items],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "sales", header: "LTO Sales", numeric: true, sortValue: (r) => r.total_sales, render: (r) => fmt$2(r.total_sales) },
      { key: "qty", header: "LTO Qty", numeric: true, sortValue: (r) => r.total_quantity, render: (r) => fmtNum(r.total_quantity) },
      {
        key: "pct_sales",
        header: "% of sales",
        numeric: true,
        sortValue: (r) => r.pct_of_store_sales,
        render: (r) => fmtPct(r.pct_of_store_sales),
      },
      {
        key: "pct_qty",
        header: "% of qty",
        numeric: true,
        sortValue: (r) => r.pct_of_store_quantity,
        render: (r) => fmtPct(r.pct_of_store_quantity),
      },
    ],
    [storeName],
  );

  const selling = rows.filter((r) => r.total_quantity > 0).length;
  const stats: ReportStat[] = [
    { label: "LTO sales", value: fmt$2(lto_totals.total_sales), sub: `of ${fmt$(store_totals.total_sales)} store sales` },
    { label: "% of store sales", value: fmtPct(lto_totals.pct_of_store_sales) },
    { label: "LTO qty", value: fmtNum(lto_totals.total_quantity), sub: `of ${fmtNum(store_totals.total_quantity)} items sold` },
    { label: "% of store qty", value: fmtPct(lto_totals.pct_of_store_quantity) },
    { label: "Stores selling LTO", value: `${fmtNum(selling)} / ${fmtNum(rows.length)}` },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="LTO items by sales">
          <BarList rows={bars} color={CATEGORIES.menu.chartColors[0]} empty="No LTO items in this range" />
        </ReportBlock>
      ),
    },
    {
      key: "items",
      label: "Items",
      content: (
        <ReportBlock title="Every LTO item">
          <PagedTable size="lg" rows={items} columns={ITEM_COLUMNS} rowKey={(r) => r.item_id} initialSort="sales" />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store" description="% = the LTO's share of that store's sales / items sold">
          <PagedTable
            size="lg"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.store}
            initialSort="pct_sales"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
            onRowClick={(r) => focusStore(r.store)}
            footerNote="click a row to focus the store"
          />
        </ReportBlock>
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="LTO"
      category="menu"
      stats={stats}
      tabs={tabs}
    />
  );
}
