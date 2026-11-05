"use client";

import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { preferFinal, useFinalLabor, type FinalLabor } from "@/components/business-reports/final-labor";
import {
  Delta,
  GRANULARITY_OPTIONS,
  bucketWeeks,
  compareText,
  defaultGranularity,
  fmt$,
  fmt$2,
  fmtDay,
  fmtNum,
  fmtRange,
  pctChangeOrNull,
  perStoreDay,
  share,
  sumKeys,
  type Granularity,
} from "@/components/business-reports/report-format";
import { LaborValue, TrendChart, storeColumn } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { SalesDay, SalesMetrics, SalesSection, SalesWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrSalesTrendCard — V1 "Weekly Sales" for a whole range: sales columns per
 *  bucket (day / week / period / quarter / year) with guests or avg ticket as
 *  a line. Granularities that would draw more than MAX_POINTS are not offered.
 *  Expand: the trend large, every bucket and every week with its change and
 *  labor % (Hiring's final where it exists, else the derived estimate), and
 *  every store.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_SALES_TREND_SPAN: V1Span = 2;

const MAX_POINTS = 120;
const MAX_TICKS = 14;
const CHART_HEIGHT = 215;
const BAR_RADIUS = 3;
const LINE_WIDTH = 3;
const LABEL_ROTATE = -45;
const LINE_COLOR = "#EAB308";
const CENTS = 2;
const COLUMN_OPACITY = 0.9;
const GRAN_ORDER: Granularity[] = GRANULARITY_OPTIONS.map((o) => o.value);
const WEEK_KEYS = ["sales", "customer_count", "total_orders", "labor_cost", "store_days"] as const;
const SALES_COLOR = CATEGORIES.sales.chartColors[0];

type LineMetric = "guests" | "ticket";

interface TrendPoint {
  key: string;
  label: string;
  start: string;
  end: string;
  /** The business weeks (by Tuesday) inside the bucket; none for a day. */
  weeks: string[];
  sales: number;
  customers: number;
  orders: number;
  laborCost: number;
  storeDays: number;
}

interface TrendRow extends TrendPoint {
  delta: number | null;
  avgTicket: number;
  labor: { value: number; isFinal: boolean };
  perStoreDay: number;
}

interface StoreRow {
  store: string;
  sales: number;
  storeDays: number;
  perStoreDay: number;
  customers: number;
  orders: number;
  avgTicket: number;
  labor: { value: number; isFinal: boolean };
}

const compact$ = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactNum = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function dayPoints(days: SalesDay[]): TrendPoint[] {
  return [...days]
    .sort((a, b) => compareText(a.date, b.date))
    .map((d) => ({
      key: d.date,
      label: fmtDay(d.date),
      start: d.date,
      end: d.date,
      weeks: [],
      sales: d.sales,
      customers: d.customer_count,
      orders: d.total_orders,
      laborCost: d.labor_cost,
      storeDays: d.store_days,
    }));
}

function weekPoints(weeks: SalesWeek[], by: Exclude<Granularity, "day">): TrendPoint[] {
  return bucketWeeks(weeks, by).map((b) => {
    const s = sumKeys(b.rows, WEEK_KEYS);
    return {
      key: b.key,
      label: b.label,
      start: b.start,
      end: b.end,
      weeks: b.rows.map((w) => w.week_start),
      sales: s.sales,
      customers: s.customer_count,
      orders: s.total_orders,
      laborCost: s.labor_cost,
      storeDays: s.store_days,
    };
  });
}

function avgTicketOf(p: { sales: number; customers: number }): number {
  return p.customers > 0 ? p.sales / p.customers : 0;
}

/**
 * Final labor for a bucket when Hiring has it for EVERY week in it (their
 * mean, V1's convention); otherwise the derived labor cost ÷ sales.
 */
function bucketLabor(p: TrendPoint, final: FinalLabor | null): { value: number; isFinal: boolean } {
  const finals = final ? p.weeks.map((w) => final.byWeek.get(w)) : [];
  const complete = finals.length > 0 && finals.every((v) => v !== undefined);
  const mean = complete ? finals.reduce<number>((s, v) => s + (v ?? 0), 0) / finals.length : null;
  return preferFinal(mean, share(p.laborCost, p.sales));
}

function toRows(points: TrendPoint[], final: FinalLabor | null): TrendRow[] {
  return points.map((p, i) => ({
    ...p,
    delta: i > 0 ? pctChangeOrNull(p.sales, points[i - 1].sales) : null,
    avgTicket: avgTicketOf(p),
    labor: bucketLabor(p, final),
    perStoreDay: perStoreDay(p.sales, p.storeDays),
  }));
}

export function BrSalesTrendCard({ data }: { data: SalesSection }) {
  const theme = useChartTheme();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Granularity>(() => defaultGranularity(data.meta.days));
  const [line, setLine] = useState<LineMetric>("guests");

  const pointsBy = useMemo<Record<Granularity, TrendPoint[]>>(() => {
    const weeks = [...data.by_week].sort((a, b) => compareText(a.week_start, b.week_start));
    return {
      day: dayPoints(data.by_date),
      week: weekPoints(weeks, "week"),
      period: weekPoints(weeks, "period"),
      quarter: weekPoints(weeks, "quarter"),
      year: weekPoints(weeks, "year"),
    };
  }, [data]);

  const options = useMemo(
    () => GRANULARITY_OPTIONS.filter((o) => pointsBy[o.value].length > 0 && pointsBy[o.value].length <= MAX_POINTS),
    [pointsBy],
  );

  // The chosen granularity, or the next coarser one that fits under MAX_POINTS.
  const effective: Granularity =
    options.find((o) => GRAN_ORDER.indexOf(o.value) >= GRAN_ORDER.indexOf(chosen))?.value ??
    options[options.length - 1]?.value ??
    "year";
  const points = pointsBy[effective];
  const granLabel = GRANULARITY_OPTIONS.find((o) => o.value === effective)?.label ?? "";

  const series = useMemo(
    () => [
      { name: "Sales", type: "column", data: points.map((p) => Math.round(p.sales)) },
      line === "guests"
        ? { name: "Guests", type: "line", data: points.map((p) => p.customers) }
        : { name: "Avg Ticket", type: "line", data: points.map((p) => Number(avgTicketOf(p).toFixed(CENTS))) },
    ],
    [points, line],
  );

  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: theme.label,
      },
      theme: { mode: theme.mode },
      colors: [SALES_COLOR, LINE_COLOR],
      plotOptions: { bar: { borderRadius: BAR_RADIUS, columnWidth: "60%" } },
      dataLabels: { enabled: false },
      stroke: { width: [0, LINE_WIDTH], curve: "smooth" },
      xaxis: {
        categories: points.map((p) => p.label),
        tickAmount: Math.min(points.length, MAX_TICKS),
        tickPlacement: "on",
        labels: {
          rotate: LABEL_ROTATE,
          hideOverlappingLabels: true,
          style: { fontSize: "9px", colors: theme.label },
        },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: [
        {
          labels: {
            formatter: (v: number) => (v == null ? "" : compact$.format(v)),
            style: { fontSize: "9px", colors: theme.label },
          },
        },
        {
          opposite: true,
          labels: {
            formatter: (v: number) => {
              if (v == null) return "";
              return line === "guests" ? compactNum.format(v) : fmt$2(v);
            },
            style: { fontSize: "9px", colors: theme.label },
          },
        },
      ],
      legend: { position: "top", horizontalAlign: "left", fontSize: "10px", labels: { colors: theme.label } },
      grid: { borderColor: theme.grid },
      tooltip: {
        shared: true,
        intersect: false,
        theme: theme.mode,
        y: {
          formatter: (v: number, opts?: { seriesIndex?: number }) =>
            opts?.seriesIndex === 0 || line === "ticket" ? fmt$2(v) : fmtNum(v),
        },
      },
      fill: { opacity: [COLUMN_OPACITY, 1] },
    }),
    [theme, points, line],
  );

  return (
    <V1Card
      title="Sales Trend"
      category="sales"
      period="R"
      span={BR_SALES_TREND_SPAN}
      showPeriodBadge={false}
      bodyClassName="overflow-hidden"
      onExpand={() => setOpen(true)}
      headerControl={
        <div className="ms-1 flex flex-wrap items-center gap-1">
          <V1Toggle<Granularity> options={options} value={effective} onChange={setChosen} />
          <V1Toggle<LineMetric>
            options={[
              { value: "guests", label: "Guests" },
              { value: "ticket", label: "Ticket" },
            ]}
            value={line}
            onChange={setLine}
          />
        </div>
      }
    >
      {points.length === 0 ? (
        <V1Empty>No sales in this range.</V1Empty>
      ) : (
        <ApexChart key={theme.key} options={chartOptions} series={series} type="line" height={CHART_HEIGHT} />
      )}

      {open && (
        <TrendDialog
          onClose={() => setOpen(false)}
          data={data}
          points={points}
          weekPointsAll={pointsBy.week}
          granularity={effective}
          granLabel={granLabel}
        />
      )}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

function periodColumns(firstHeader: string): PagedColumn<TrendRow>[] {
  return [
    {
      key: "start",
      header: firstHeader,
      sortValue: (r) => r.start,
      render: (r) => (
        <div className="leading-tight">
          <div className="font-semibold">{r.label}</div>
          <div className="text-xs text-muted-foreground">{fmtRange(r.start, r.end)}</div>
        </div>
      ),
    },
    { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
    {
      key: "delta",
      header: "Δ vs prev",
      numeric: true,
      sortValue: (r) => r.delta,
      render: (r) => <Delta value={r.delta} />,
    },
    {
      key: "psd",
      header: "Per store-day",
      numeric: true,
      sortValue: (r) => r.perStoreDay,
      render: (r) => fmt$(r.perStoreDay),
    },
    {
      key: "customers",
      header: "Guests",
      numeric: true,
      sortValue: (r) => r.customers,
      render: (r) => fmtNum(r.customers),
    },
    { key: "orders", header: "Orders", numeric: true, sortValue: (r) => r.orders, render: (r) => fmtNum(r.orders) },
    {
      key: "ticket",
      header: "Avg ticket",
      numeric: true,
      sortValue: (r) => r.avgTicket,
      render: (r) => fmt$2(r.avgTicket),
    },
    {
      key: "labor",
      header: "Labor %",
      numeric: true,
      sortValue: (r) => (r.labor.value > 0 ? r.labor.value : null),
      render: (r) => <LaborValue value={r.labor.value} isFinal={r.labor.isFinal} />,
    },
  ];
}

function storeRow(store: string, m: SalesMetrics, final: FinalLabor | null): StoreRow {
  return {
    store,
    sales: m.sales,
    storeDays: m.store_days,
    perStoreDay: perStoreDay(m.sales, m.store_days),
    customers: m.customer_count,
    orders: m.total_orders,
    avgTicket: avgTicketOf({ sales: m.sales, customers: m.customer_count }),
    labor: preferFinal(final?.byStore.get(store), m.labor_percent),
  };
}

function TrendDialog({
  onClose,
  data,
  points,
  weekPointsAll,
  granularity,
  granLabel,
}: {
  onClose: () => void;
  data: SalesSection;
  points: TrendPoint[];
  weekPointsAll: TrendPoint[];
  granularity: Granularity;
  granLabel: string;
}) {
  const { storeName } = useReport();
  const final = useFinalLabor();
  const unit = granLabel.toLowerCase();
  const t = data.totals;

  const rows = useMemo(() => toRows(points, final), [points, final]);
  const weekRows = useMemo(() => toRows(weekPointsAll, final), [weekPointsAll, final]);
  const storeRows = useMemo(
    () => Object.entries(data.by_store).map(([store, m]) => storeRow(store, m, final)),
    [data.by_store, final],
  );

  // Best / worst on sales per store-day, so a clipped edge bucket or a bucket
  // with fewer reporting stores is not "worst" just for being shorter.
  const { best, worst } = useMemo(() => {
    const ranked = rows.filter((r) => r.storeDays > 0);
    const pick = (better: (a: TrendRow, b: TrendRow) => boolean) =>
      ranked.reduce<TrendRow | null>((acc, r) => (acc === null || better(r, acc) ? r : acc), null);
    return { best: pick((a, b) => a.perStoreDay > b.perStoreDay), worst: pick((a, b) => a.perStoreDay < b.perStoreDay) };
  }, [rows]);

  const overallLabor = preferFinal(final?.overall, t.labor_percent);

  const stats: ReportStat[] = [
    { label: "Sales", value: fmt$(t.sales), sub: `${fmt$(perStoreDay(t.sales, t.store_days))} per store-day` },
    { label: `Avg per ${unit}`, value: fmt$(rows.length > 0 ? t.sales / rows.length : 0), sub: `${fmtNum(rows.length)} ${unit}s` },
    {
      label: `Best ${unit}`,
      value: best ? best.label : "—",
      sub: best ? `${fmt$(best.perStoreDay)} / store-day` : undefined,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: `Worst ${unit}`,
      value: worst ? worst.label : "—",
      sub: worst ? `${fmt$(worst.perStoreDay)} / store-day` : undefined,
      tone: "text-red-600 dark:text-red-400",
    },
    { label: "Guests", value: fmtNum(t.customer_count), sub: `${fmt$2(t.avg_ticket)} avg ticket` },
    {
      label: overallLabor.isFinal ? "Labor % · Final" : "Labor % · Est.",
      value: overallLabor.value > 0 ? `${overallLabor.value.toFixed(1)}%` : "—",
      sub: overallLabor.isFinal ? "Hiring's final labor" : "labor cost ÷ sales",
    },
  ];

  const bucketCols = useMemo(() => periodColumns(granLabel), [granLabel]);
  const weekCols = useMemo(() => periodColumns("Week"), []);
  const storeCols = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      storeColumn<StoreRow>(storeName),
      { key: "sales", header: "Sales", numeric: true, sortValue: (r) => r.sales, render: (r) => fmt$(r.sales) },
      {
        key: "psd",
        header: "Per store-day",
        numeric: true,
        sortValue: (r) => r.perStoreDay,
        render: (r) => fmt$(r.perStoreDay),
      },
      { key: "days", header: "Days", numeric: true, sortValue: (r) => r.storeDays, render: (r) => fmtNum(r.storeDays) },
      { key: "guests", header: "Guests", numeric: true, sortValue: (r) => r.customers, render: (r) => fmtNum(r.customers) },
      { key: "orders", header: "Orders", numeric: true, sortValue: (r) => r.orders, render: (r) => fmtNum(r.orders) },
      {
        key: "ticket",
        header: "Avg ticket",
        numeric: true,
        sortValue: (r) => r.avgTicket,
        render: (r) => fmt$2(r.avgTicket),
      },
      {
        key: "labor",
        header: "Labor %",
        numeric: true,
        sortValue: (r) => (r.labor.value > 0 ? r.labor.value : null),
        render: (r) => <LaborValue value={r.labor.value} isFinal={r.labor.isFinal} />,
      },
    ],
    [storeName],
  );

  const chartBars = useMemo(() => [{ name: "Sales", data: points.map((p) => Math.round(p.sales)), color: SALES_COLOR }], [points]);
  const chartLine = useMemo(
    () => ({ name: "Guests", data: points.map((p) => p.customers), color: LINE_COLOR }),
    [points],
  );
  const categories = useMemo(() => points.map((p) => p.label), [points]);

  const laborNote = "Labor %: Final = Hiring's weekly final labor (a bucket is Final only when every week in it has one); Est. = labor cost ÷ sales.";

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title={`Sales and guests by ${unit}`} description={`${fmtNum(points.length)} ${unit}s in the range`}>
          <TrendChart categories={categories} bars={chartBars} line={chartLine} lineFormat={fmtNum} />
        </ReportBlock>
      ),
    },
    {
      key: "buckets",
      label: `By ${unit}`,
      content: (
        <ReportBlock title={`Every ${unit}`} description={laborNote}>
          <PagedTable size="lg" rows={rows} columns={bucketCols} rowKey={(r) => r.key} initialSort="start" initialDir="desc" />
        </ReportBlock>
      ),
    },
    ...(granularity === "week"
      ? []
      : [
          {
            key: "weeks",
            label: "By week",
            content: (
              <ReportBlock title="Every week" description={laborNote}>
                <PagedTable size="lg" rows={weekRows} columns={weekCols} rowKey={(r) => r.key} initialSort="start" initialDir="desc" />
              </ReportBlock>
            ),
          },
        ]),
    {
      key: "stores",
      label: "By store",
      content: (
        <ReportBlock title="Every store" description="Labor %: Final = mean of the store's final weeks; Est. = labor cost ÷ sales.">
          <PagedTable
            size="lg"
            rows={storeRows}
            columns={storeCols}
            rowKey={(r) => r.store}
            initialSort="sales"
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
      title={`Sales Trend — by ${unit}`}
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
