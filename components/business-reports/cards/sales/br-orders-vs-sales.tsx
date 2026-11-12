"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import {
  PCT_DIGITS,
  bucketWeeks,
  compareText,
  fmt$,
  fmtPct,
  fmtRange,
  ppDelta,
  share,
  sumKeys,
  weekLabel,
} from "@/components/business-reports/report-format";
import { Money, TrendChart, storeColumn } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { OperationsMetrics, OperationsSection, ReportWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrOrdersVsSalesCard — V1 "Orders vs Sales" over the range: sales, Blue Line
 *  and Pepsi totals with their % of sales, then every week (latest first)
 *  with the percentage-point change vs the week before. Expand: the weekly
 *  trend, every week and every store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_ORDERS_VS_SALES_SPAN: V1Span = 2;

const MAX_POINTS = 120;
const CHART_KEYS = ["sales", "blue_line_total", "pepsi_total"] as const;
const [BLUE_COLOR, PEPSI_COLOR] = CATEGORIES.sales.chartColors;
const PCT_LINE_COLOR = "#0ea5e9";

type OpsWeek = ReportWeek & OperationsMetrics;

interface WeekRow {
  week: OpsWeek;
  label: string;
  blueDelta: number | null;
  pepsiDelta: number | null;
}

interface StoreRow extends OperationsMetrics {
  store: string;
}

function PpChange({ value, size = "sm" }: { value: number | null; size?: "sm" | "lg" }) {
  if (value === null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        size === "sm" ? "text-[10px] text-muted-foreground" : "text-xs font-medium",
        size === "lg" && value > 0 && "text-emerald-600 dark:text-emerald-400",
        size === "lg" && value < 0 && "text-red-600 dark:text-red-400",
      )}
    >
      {value > 0 ? "+" : ""}
      {value.toFixed(PCT_DIGITS)}pp
    </span>
  );
}

function pctOrDash(total: number, pct: number): string {
  return total > 0 ? fmtPct(pct) : "—";
}

export function BrOrdersVsSalesCard({ data }: { data: OperationsSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  /** Oldest first. */
  const weeks = useMemo<WeekRow[]>(() => {
    const asc = [...data.by_week].sort((a, b) => compareText(a.week_start, b.week_start));
    return asc.map((week, i) => {
      const prev = i > 0 ? asc[i - 1] : null;
      return {
        week,
        label: weekLabel(week),
        blueDelta: prev ? ppDelta(week.blue_line_pct, prev.blue_line_pct) : null,
        pepsiDelta: prev && week.pepsi_total > 0 && prev.pepsi_total > 0 ? ppDelta(week.pepsi_pct, prev.pepsi_pct) : null,
      };
    });
  }, [data.by_week]);
  const latestFirst = useMemo(() => [...weeks].reverse(), [weeks]);

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
          <V1Metric size="sm" label="Sales" value={<Money value={t.sales} />} />
          <V1Metric
            size="sm"
            label="Blue Line"
            value={<Money value={t.blue_line_total} />}
            sub={`${fmtPct(t.blue_line_pct)} of sales`}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <V1Metric
            size="sm"
            label="Pepsi"
            value={t.pepsi_total > 0 ? <Money value={t.pepsi_total} /> : "—"}
            sub={t.pepsi_total > 0 ? `${fmtPct(t.pepsi_pct)} of sales` : undefined}
          />
        </V1MetricGrid>

        {latestFirst.length === 0 ? (
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
              {latestFirst.map(({ week, label, blueDelta, pepsiDelta }) => (
                <tr key={week.week_start}>
                  <td className={V1_TD}>{label}</td>
                  <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                    <Money value={week.sales} />
                  </td>
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

      {open && <OrdersDialog data={data} weeks={weeks} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

const WEEK_COLUMNS: PagedColumn<WeekRow>[] = [
  {
    key: "week",
    header: "Week",
    sortValue: (r) => r.week.week_start,
    render: (r) => (
      <div className="leading-tight">
        <div className="font-semibold">{r.label}</div>
        <div className="text-xs text-muted-foreground">{fmtRange(r.week.start, r.week.end)}</div>
      </div>
    ),
  },
  { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.week.sales, render: (r) => fmt$(r.week.sales) },
  {
    key: "blue",
    header: "Blue Line",
    numeric: true,
    sortValue: (r) => r.week.blue_line_total,
    render: (r) => fmt$(r.week.blue_line_total),
  },
  {
    key: "blue_pct",
    header: "Blue %",
    numeric: true,
    sortValue: (r) => r.week.blue_line_pct,
    render: (r) => (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtPct(r.week.blue_line_pct)}</span>
    ),
  },
  { key: "blue_d", header: "Δ vs prev", numeric: true, sortValue: (r) => r.blueDelta, render: (r) => <PpChange value={r.blueDelta} size="lg" /> },
  {
    key: "pepsi",
    header: "Pepsi",
    numeric: true,
    sortValue: (r) => r.week.pepsi_total,
    render: (r) => (r.week.pepsi_total > 0 ? fmt$(r.week.pepsi_total) : "—"),
  },
  {
    key: "pepsi_pct",
    header: "Pepsi %",
    numeric: true,
    sortValue: (r) => (r.week.pepsi_total > 0 ? r.week.pepsi_pct : null),
    render: (r) => pctOrDash(r.week.pepsi_total, r.week.pepsi_pct),
  },
  { key: "pepsi_d", header: "Δ vs prev", numeric: true, sortValue: (r) => r.pepsiDelta, render: (r) => <PpChange value={r.pepsiDelta} size="lg" /> },
];

function OrdersDialog({ data, weeks, onClose }: { data: OperationsSection; weeks: WeekRow[]; onClose: () => void }) {
  const { storeName, focusStore } = useReport();
  const t = data.totals;

  // Weekly when it fits the chart, else fiscal periods; % recomputed from the sums.
  const chart = useMemo(() => {
    const asc = weeks.map((w) => w.week);
    const byWeek = asc.length <= MAX_POINTS;
    const buckets = bucketWeeks(asc, byWeek ? "week" : "period").map((b) => ({
      label: b.label,
      ...sumKeys(b.rows, CHART_KEYS),
    }));
    return {
      byWeek,
      categories: buckets.map((b) => b.label),
      bars: [
        { name: "Blue Line", data: buckets.map((b) => Math.round(b.blue_line_total)), color: BLUE_COLOR },
        { name: "Pepsi", data: buckets.map((b) => Math.round(b.pepsi_total)), color: PEPSI_COLOR },
      ],
      line: {
        name: "Blue Line % of sales",
        data: buckets.map((b) => share(b.blue_line_total, b.sales)),
        color: PCT_LINE_COLOR,
      },
    };
  }, [weeks]);

  const stores = useMemo<StoreRow[]>(() => Object.entries(data.by_store).map(([store, m]) => ({ ...m, store })), [data.by_store]);
  const storeCols = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
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

  const ranked = stores.filter((s) => s.sales > 0);
  const top = ranked.reduce<StoreRow | null>((a, s) => (a === null || s.blue_line_pct > a.blue_line_pct ? s : a), null);
  const low = ranked.reduce<StoreRow | null>((a, s) => (a === null || s.blue_line_pct < a.blue_line_pct ? s : a), null);

  const stats: ReportStat[] = [
    { label: "Sales", value: fmt$(t.sales) },
    { label: "Blue Line", value: fmt$(t.blue_line_total), sub: `${fmtPct(t.blue_line_pct)} of sales`, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Pepsi", value: t.pepsi_total > 0 ? fmt$(t.pepsi_total) : "—", sub: t.pepsi_total > 0 ? `${fmtPct(t.pepsi_pct)} of sales` : undefined },
    { label: "Highest Blue %", value: top ? fmtPct(top.blue_line_pct) : "—", sub: top ? storeName(top.store) : undefined },
    { label: "Lowest Blue %", value: low ? fmtPct(low.blue_line_pct) : "—", sub: low ? storeName(low.store) : undefined },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock
          title={chart.byWeek ? "Blue Line and Pepsi by week" : "Blue Line and Pepsi by fiscal period"}
          description="Columns = ordering totals; line = Blue Line as % of sales"
        >
          <TrendChart categories={chart.categories} bars={chart.bars} line={chart.line} lineFormat={(v) => fmtPct(v)} />
        </ReportBlock>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: (
        <ReportBlock title="Every week" description="Δ = percentage-point change vs the week before">
          <PagedTable size="lg" rows={weeks} columns={WEEK_COLUMNS} rowKey={(r) => r.week.week_start} initialSort="week" initialDir="desc" />
        </ReportBlock>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store">
          <PagedTable
            size="lg"
            rows={stores}
            columns={storeCols}
            rowKey={(r) => r.store}
            initialSort="blue_pct"
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
      title="Orders vs Sales"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
