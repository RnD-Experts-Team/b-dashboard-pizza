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
  Delta,
  bucketWeeks,
  compareText,
  fmt$,
  fmtNum,
  fmtPct,
  fmtRange,
  pctChangeOrNull,
  share,
  sumKeys,
  weekLabel,
} from "@/components/business-reports/report-format";
import { Money, TrendChart, storeColumn } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPhoneInStoreCard — V1 "Phone & In-Store" over the range: Phone and In
 *  Store (register) totals with their share of sales, then every week inside
 *  the range (latest first) with week-over-week change. Expand: the weekly
 *  trend, every week, every store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PHONE_INSTORE_SPAN: V1Span = 1;

const METRICS = [
  { key: "phone_sales", label: "Phone" },
  { key: "register_sales", label: "In Store" },
] as const;

const MAX_POINTS = 120;
const CHART_KEYS = ["phone_sales", "register_sales", "sales"] as const;
const [PHONE_COLOR, INSTORE_COLOR] = CATEGORIES.sales.chartColors;

interface WeekRow {
  week: SalesWeek;
  prev: SalesWeek | null;
}

interface WeekTableRow {
  key: string;
  label: string;
  start: string;
  end: string;
  phone: number;
  phoneDelta: number | null;
  phoneShare: number;
  inStore: number;
  inStoreDelta: number | null;
  inStoreShare: number;
}

interface StoreRow {
  store: string;
  sales: number;
  phone: number;
  phoneShare: number;
  inStore: number;
  inStoreShare: number;
}

const SMALL_DELTA = "[&>span]:!px-1 [&>span]:!py-0 [&>span]:!text-[9px] [&>span_svg]:!h-2 [&>span_svg]:!w-2";

export function BrPhoneInStoreCard({ data }: { data: SalesSection }) {
  const [open, setOpen] = useState(false);
  const t = data.totals;

  const asc = useMemo(() => [...data.by_week].sort((a, b) => compareText(a.week_start, b.week_start)), [data.by_week]);
  const rows = useMemo<WeekRow[]>(
    () => asc.map((week, i) => ({ week, prev: i > 0 ? asc[i - 1] : null })).reverse(),
    [asc],
  );

  return (
    <V1Card
      title="Phone & In-Store"
      category="sales"
      period="R"
      span={BR_PHONE_INSTORE_SPAN}
      bodyClassName="px-0 overflow-x-hidden"
      onExpand={() => setOpen(true)}
    >
      <div className="space-y-1.5">
        <V1MetricGrid className="px-3">
          {METRICS.map((m) => (
            <V1Metric
              key={m.key}
              size="sm"
              label={m.label}
              value={<Money value={t[m.key]} />}
              sub={`${fmtPct(share(t[m.key], t.sales))} of sales`}
            />
          ))}
        </V1MetricGrid>

        {rows.length === 0 ? (
          <V1Empty>No weeks in this range.</V1Empty>
        ) : (
          <table className={cn(V1_TBL, "[&_td]:!px-1.5 [&_th]:!px-1.5")}>
            <thead>
              <tr>
                <th className={V1_TH}>Week</th>
                {METRICS.map((m) => (
                  <th key={m.key} className={cn(V1_TH, V1_NUM)}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ week, prev }) => (
                <tr key={week.week_start}>
                  <td className={cn(V1_TD, "font-semibold text-foreground/70")}>{weekLabel(week)}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className={cn(V1_TD, V1_NUM)}>
                      <div className="font-semibold leading-tight tabular-nums">
                        <Money value={week[m.key]} />
                      </div>
                      <div className={cn("flex justify-end leading-tight", SMALL_DELTA)}>
                        <Delta value={prev ? pctChangeOrNull(week[m.key], prev[m.key]) : null} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && <PhoneDialog data={data} weeks={asc} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

const WEEK_COLUMNS: PagedColumn<WeekTableRow>[] = [
  {
    key: "start",
    header: "Week",
    sortValue: (r) => r.start,
    render: (r) => (
      <div className="leading-tight">
        <div className="font-semibold">{r.label}</div>
        <div className="text-xs text-muted-foreground">{fmtRange(r.start, r.end)}</div>
      </div>
    ),
  },
  { key: "phone", header: "Phone", numeric: true, sortValue: (r) => r.phone, render: (r) => fmt$(r.phone) },
  { key: "phone_d", header: "Δ phone", numeric: true, sortValue: (r) => r.phoneDelta, render: (r) => <Delta value={r.phoneDelta} /> },
  { key: "phone_s", header: "Phone %", numeric: true, sortValue: (r) => r.phoneShare, render: (r) => fmtPct(r.phoneShare) },
  { key: "in", header: "In Store", numeric: true, sortValue: (r) => r.inStore, render: (r) => fmt$(r.inStore) },
  { key: "in_d", header: "Δ in store", numeric: true, sortValue: (r) => r.inStoreDelta, render: (r) => <Delta value={r.inStoreDelta} /> },
  { key: "in_s", header: "In Store %", numeric: true, sortValue: (r) => r.inStoreShare, render: (r) => fmtPct(r.inStoreShare) },
];

function storeRowOf(store: string, m: SalesMetrics): StoreRow {
  return {
    store,
    sales: m.sales,
    phone: m.phone_sales,
    phoneShare: share(m.phone_sales, m.sales),
    inStore: m.register_sales,
    inStoreShare: share(m.register_sales, m.sales),
  };
}

function PhoneDialog({ data, weeks, onClose }: { data: SalesSection; weeks: SalesWeek[]; onClose: () => void }) {
  const { storeName } = useReport();
  const t = data.totals;

  const weekRows = useMemo<WeekTableRow[]>(
    () =>
      weeks.map((w, i) => {
        const prev = i > 0 ? weeks[i - 1] : null;
        return {
          key: w.week_start,
          label: weekLabel(w),
          start: w.start,
          end: w.end,
          phone: w.phone_sales,
          phoneDelta: prev ? pctChangeOrNull(w.phone_sales, prev.phone_sales) : null,
          phoneShare: share(w.phone_sales, w.sales),
          inStore: w.register_sales,
          inStoreDelta: prev ? pctChangeOrNull(w.register_sales, prev.register_sales) : null,
          inStoreShare: share(w.register_sales, w.sales),
        };
      }),
    [weeks],
  );

  // Weekly when it fits the chart, else fiscal periods.
  const chart = useMemo(() => {
    const buckets = bucketWeeks(weeks, weeks.length <= MAX_POINTS ? "week" : "period").map((b) => ({
      label: b.label,
      ...sumKeys(b.rows, CHART_KEYS),
    }));
    return {
      categories: buckets.map((b) => b.label),
      bars: [
        { name: "Phone", data: buckets.map((b) => Math.round(b.phone_sales)), color: PHONE_COLOR },
        { name: "In Store", data: buckets.map((b) => Math.round(b.register_sales)), color: INSTORE_COLOR },
      ],
      byWeek: weeks.length <= MAX_POINTS,
    };
  }, [weeks]);

  const stores = useMemo(() => Object.entries(data.by_store).map(([s, m]) => storeRowOf(s, m)), [data.by_store]);
  const storeCols = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
      { key: "phone", header: "Phone", numeric: true, sortValue: (r) => r.phone, render: (r) => fmt$(r.phone) },
      { key: "phone_s", header: "Phone %", numeric: true, sortValue: (r) => r.phoneShare, render: (r) => fmtPct(r.phoneShare) },
      { key: "in", header: "In Store", numeric: true, sortValue: (r) => r.inStore, render: (r) => fmt$(r.inStore) },
      { key: "in_s", header: "In Store %", numeric: true, sortValue: (r) => r.inStoreShare, render: (r) => fmtPct(r.inStoreShare) },
    ],
    [storeName],
  );

  const stats: ReportStat[] = [
    { label: "Phone", value: fmt$(t.phone_sales), sub: `${fmtPct(share(t.phone_sales, t.sales))} of sales` },
    { label: "In Store", value: fmt$(t.register_sales), sub: `${fmtPct(share(t.register_sales, t.sales))} of sales` },
    { label: "Phone orders", value: fmtNum(t.phone_orders) },
    { label: "Sales", value: fmt$(t.sales), sub: `${fmtNum(weeks.length)} weeks` },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title={chart.byWeek ? "Phone and In Store by week" : "Phone and In Store by fiscal period"}>
          <TrendChart categories={chart.categories} bars={chart.bars} />
        </ReportBlock>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: (
        <ReportBlock title="Every week" description="Δ = change vs the week before; % = share of that week's sales">
          <PagedTable size="lg" rows={weekRows} columns={WEEK_COLUMNS} rowKey={(r) => r.key} initialSort="start" initialDir="desc" />
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
            initialSort="phone"
            searchText={(r) => storeName(r.store)}
            searchPlaceholder="Search stores…"
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
      title="Phone & In-Store"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
