"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmtNum, fmtPct2 } from "@/components/business-reports/report-format";
import type { LtoTotals, MenuSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrLtoCard — V1 "Weekly LTO" over the range: limited-time-offer sales and
 *  quantity with their share of store totals, per item. Expand: per store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_LTO_SPAN: V1Span = 1;

type StoreRow = { store: string } & LtoTotals;

export function BrLtoCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
  const { lto_totals, items } = data.lto;

  return (
    <V1Card title="LTO" category="menu" period="R" span={BR_LTO_SPAN} onExpand={() => setOpen(true)}>
      <div className="space-y-2">
        <V1MetricGrid>
          <V1Metric label="LTO Sales" value={fmt$2(lto_totals.total_sales)} />
          <V1Metric label="LTO Qty" value={fmtNum(lto_totals.total_quantity)} />
          <V1Metric label="% of Store Sales" value={fmtPct2(lto_totals.pct_of_store_sales)} />
          <V1Metric label="% of Store Qty" value={fmtPct2(lto_totals.pct_of_store_quantity)} />
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
                <th className={cn(V1_TH, V1_NUM)}>% Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.item_id}>
                  <td className={cn(V1_TD, "tabular-nums")}>{it.item_id}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmt$2(it.sales)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmtNum(it.quantity)}</td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtPct2(it.pct_of_store_sales)}</td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtPct2(it.pct_of_store_quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="LTO — by store"
        badgeText={`${fmtNum(Object.keys(data.lto.by_store).length)} stores`}
      >
        {open && <LtoStores byStore={data.lto.by_store} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

function LtoStores({ byStore }: { byStore: Record<string, LtoTotals> }) {
  const { storeName, focusStore } = useReport();
  const rows = useMemo<StoreRow[]>(() => Object.entries(byStore).map(([store, t]) => ({ ...t, store })), [byStore]);

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      {
        key: "sales",
        header: "LTO Sales",
        numeric: true,
        sortValue: (r) => r.total_sales,
        render: (r) => fmt$2(r.total_sales),
      },
      {
        key: "qty",
        header: "LTO Qty",
        numeric: true,
        sortValue: (r) => r.total_quantity,
        render: (r) => fmtNum(r.total_quantity),
      },
      {
        key: "pct_sales",
        header: "% Sales",
        numeric: true,
        sortValue: (r) => r.pct_of_store_sales,
        render: (r) => fmtPct2(r.pct_of_store_sales),
      },
      {
        key: "pct_qty",
        header: "% Qty",
        numeric: true,
        sortValue: (r) => r.pct_of_store_quantity,
        render: (r) => fmtPct2(r.pct_of_store_quantity),
      },
    ],
    [storeName],
  );

  return (
    <PagedTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.store}
      initialSort="pct_sales"
      onRowClick={(r) => focusStore(r.store)}
      footerNote="click a row to focus the store"
    />
  );
}
