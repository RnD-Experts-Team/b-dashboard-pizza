"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$, fmtNum, fmtPct, ppDelta, weekLabel } from "@/components/business-reports/report-format";
import type { OperationsMetrics, OperationsSection, ReportWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrOrdersVsSalesCard — V1 "Orders vs Sales" over the range: sales, Blue Line
 *  and Pepsi totals with their % of sales, then every week (latest first)
 *  with the percentage-point change vs the week before. Expand: per store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_ORDERS_VS_SALES_SPAN: V1Span = 2;

type OpsWeek = ReportWeek & OperationsMetrics;

interface WeekRow {
  week: OpsWeek;
  blueDelta: number | null;
  pepsiDelta: number | null;
}

interface StoreRow extends OperationsMetrics {
  store: string;
}

function PpChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span className="text-[10px] text-muted-foreground tabular-nums">
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}pp
    </span>
  );
}

function pctOrDash(total: number, pct: number): string {
  return total > 0 ? fmtPct(pct) : "—";
}

export function BrOrdersVsSalesCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  const rows = useMemo<WeekRow[]>(() => {
    const asc = [...data.by_week].sort((a, b) => a.week_start.localeCompare(b.week_start));
    return asc
      .map((week, i) => {
        const prev = i > 0 ? asc[i - 1] : null;
        return {
          week,
          blueDelta: prev ? ppDelta(week.blue_line_pct, prev.blue_line_pct) : null,
          pepsiDelta: prev && week.pepsi_total > 0 && prev.pepsi_total > 0 ? ppDelta(week.pepsi_pct, prev.pepsi_pct) : null,
        };
      })
      .reverse();
  }, [data.by_week]);

  return (
    <V1Card
      title="Orders vs Sales"
      category="sales"
      period="R"
      span={BR_ORDERS_VS_SALES_SPAN}
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={3}>
          <V1Metric size="sm" label="Sales" value={fmt$(t.sales)} />
          <V1Metric
            size="sm"
            label="Blue Line"
            value={fmt$(t.blue_line_total)}
            sub={`${fmtPct(t.blue_line_pct)} of sales`}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <V1Metric
            size="sm"
            label="Pepsi"
            value={t.pepsi_total > 0 ? fmt$(t.pepsi_total) : "—"}
            sub={t.pepsi_total > 0 ? `${fmtPct(t.pepsi_pct)} of sales` : undefined}
          />
        </V1MetricGrid>

        {rows.length === 0 ? (
          <V1Empty>No weeks in this range.</V1Empty>
        ) : (
          <table className={V1_TBL}>
            <thead>
              <tr>
                <th className={V1_TH}>Week</th>
                <th className={cn(V1_TH, V1_NUM)}>Sales</th>
                <th className={cn(V1_TH, V1_NUM)}>Blue Line %</th>
                <th className={cn(V1_TH, V1_NUM)}>Δ</th>
                <th className={cn(V1_TH, V1_NUM)}>Pepsi %</th>
                <th className={cn(V1_TH, V1_NUM)}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ week, blueDelta, pepsiDelta }) => (
                <tr key={week.week_start}>
                  <td className={V1_TD}>{weekLabel(week)}</td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmt$(week.sales)}</td>
                  <td className={cn(V1_TD, V1_NUM, "font-medium text-emerald-600 dark:text-emerald-400")}>
                    {fmtPct(week.blue_line_pct)}
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    <PpChange value={blueDelta} />
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>{pctOrDash(week.pepsi_total, week.pepsi_pct)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>
                    <PpChange value={pepsiDelta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Orders vs Sales — by store"
        badgeText={`${fmtNum(Object.keys(data.by_store).length)} stores`}
      >
        {open && <StoresDetail byStore={data.by_store} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

function StoresDetail({ byStore }: { byStore: Record<string, OperationsMetrics> }) {
  const { storeName, focusStore } = useReport();

  const rows = useMemo<StoreRow[]>(
    () => Object.entries(byStore).map(([store, m]) => ({ ...m, store })),
    [byStore],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
      {
        key: "blue",
        header: "Blue Line",
        numeric: true,
        sortValue: (r) => r.blue_line_total,
        render: (r) => fmt$(r.blue_line_total),
      },
      {
        key: "blue_pct",
        header: "Blue %",
        numeric: true,
        sortValue: (r) => r.blue_line_pct,
        render: (r) => (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtPct(r.blue_line_pct)}</span>
        ),
      },
      {
        key: "pepsi",
        header: "Pepsi",
        numeric: true,
        sortValue: (r) => r.pepsi_total,
        render: (r) => (r.pepsi_total > 0 ? fmt$(r.pepsi_total) : "—"),
      },
      {
        key: "pepsi_pct",
        header: "Pepsi %",
        numeric: true,
        sortValue: (r) => (r.pepsi_total > 0 ? r.pepsi_pct : null),
        render: (r) => pctOrDash(r.pepsi_total, r.pepsi_pct),
      },
    ],
    [storeName],
  );

  return (
    <PagedTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.store}
      initialSort="blue_pct"
      onRowClick={(r) => focusStore(r.store)}
      footerNote="click a row to focus the store"
    />
  );
}
