"use client";

import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel, V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { ApexChart, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import {
  Delta,
  GRANULARITY_OPTIONS,
  bucketWeeks,
  defaultGranularity,
  fmt$,
  fmt$2,
  fmtDay,
  fmtNum,
  fmtPct,
  fmtRange,
  laborColor,
  pctChangeOrNull,
  perStoreDay,
  share,
  sumKeys,
  type Granularity,
} from "@/components/business-reports/report-format";
import type { SalesDay, SalesSection, SalesWeek } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrSalesTrendCard — V1 "Weekly Sales" for a whole range: sales columns per
 *  bucket (day / week / period / quarter / year) with guests or avg ticket as
 *  a line. Granularities that would draw more than MAX_POINTS are not offered.
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

type LineMetric = "guests" | "ticket";

interface TrendPoint {
  key: string;
  label: string;
  start: string;
  end: string;
  sales: number;
  customers: number;
  orders: number;
  laborCost: number;
  storeDays: number;
}

interface TrendRow extends TrendPoint {
  delta: number | null;
  avgTicket: number;
  laborPct: number;
  perStoreDay: number;
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
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      key: d.date,
      label: fmtDay(d.date),
      start: d.date,
      end: d.date,
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
      sales: s.sales,
      customers: s.customer_count,
      orders: s.total_orders,
      laborCost: s.labor_cost,
      storeDays: s.store_days,
    };
  });
}

function avgTicketOf(p: TrendPoint): number {
  return p.customers > 0 ? p.sales / p.customers : 0;
}

export function BrSalesTrendCard({ data }: { data: SalesSection }) {
  const theme = useChartTheme();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Granularity>(() => defaultGranularity(data.meta.days));
  const [line, setLine] = useState<LineMetric>("guests");

  const pointsBy = useMemo<Record<Granularity, TrendPoint[]>>(() => {
    const weeks = [...data.by_week].sort((a, b) => a.week_start.localeCompare(b.week_start));
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
      colors: [CATEGORIES.sales.chartColors[0], LINE_COLOR],
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

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title={`Sales Trend — by ${granLabel.toLowerCase()}`}
        badgeText={`${fmtNum(points.length)} ${granLabel.toLowerCase()}s`}
        className="sm:max-w-5xl"
      >
        {open && <TrendDetail points={points} granLabel={granLabel} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

/* ── Expand dialog body — mounted only while open ────────────────────────── */

function TrendDetail({ points, granLabel }: { points: TrendPoint[]; granLabel: string }) {
  const { rangeLabel } = useReport();

  const rows = useMemo<TrendRow[]>(
    () =>
      points.map((p, i) => ({
        ...p,
        delta: i > 0 ? pctChangeOrNull(p.sales, points[i - 1].sales) : null,
        avgTicket: avgTicketOf(p),
        laborPct: share(p.laborCost, p.sales),
        perStoreDay: perStoreDay(p.sales, p.storeDays),
      })),
    [points],
  );

  // Best / worst on sales per store-day, so a clipped edge bucket or a bucket
  // with fewer reporting stores is not "worst" just for being shorter.
  const { best, worst, total } = useMemo(() => {
    const ranked = rows.filter((r) => r.storeDays > 0);
    const byPsd = (pick: (a: TrendRow, b: TrendRow) => boolean) =>
      ranked.reduce<TrendRow | null>((acc, r) => (acc === null || pick(r, acc) ? r : acc), null);
    return {
      best: byPsd((a, b) => a.perStoreDay > b.perStoreDay),
      worst: byPsd((a, b) => a.perStoreDay < b.perStoreDay),
      total: rows.reduce((s, r) => s + r.sales, 0),
    };
  }, [rows]);

  const columns = useMemo<PagedColumn<TrendRow>[]>(
    () => [
      {
        key: "start",
        header: granLabel,
        sortValue: (r) => r.start,
        render: (r) => (
          <div className="leading-tight">
            <div className="font-semibold">{r.label}</div>
            <div className="text-[9px] text-muted-foreground">{fmtRange(r.start, r.end)}</div>
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
        key: "customers",
        header: "Customers",
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
        sortValue: (r) => (r.laborPct > 0 ? r.laborPct : null),
        render: (r) =>
          r.laborPct > 0 ? (
            <span className="font-semibold" style={{ color: laborColor(r.laborPct) }}>
              {fmtPct(r.laborPct)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [granLabel],
  );

  return (
    <div className="space-y-4">
      <V1MetricGrid cols={4}>
        <V1Metric label="Total sales" value={fmt$(total)} sub={rangeLabel} />
        <V1Metric
          label={`Average per ${granLabel.toLowerCase()}`}
          value={fmt$(rows.length > 0 ? total / rows.length : 0)}
          sub={`${fmtNum(rows.length)} ${granLabel.toLowerCase()}s`}
        />
        <V1Metric
          label={`Best ${granLabel.toLowerCase()}`}
          value={best ? fmt$(best.sales) : "—"}
          sub={best ? `${best.label} · ${fmt$(best.perStoreDay)}/store-day` : undefined}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <V1Metric
          label={`Worst ${granLabel.toLowerCase()}`}
          value={worst ? fmt$(worst.sales) : "—"}
          sub={worst ? `${worst.label} · ${fmt$(worst.perStoreDay)}/store-day` : undefined}
          accent="text-red-600 dark:text-red-400"
        />
      </V1MetricGrid>
      <div>
        <V1SubLabel className="mb-1 px-1">Per {granLabel.toLowerCase()} · best/worst ranked by sales per store-day</V1SubLabel>
        <PagedTable rows={rows} columns={columns} rowKey={(r) => r.key} initialSort="start" initialDir="desc" />
      </div>
    </div>
  );
}
