"use client";

import { useCallback, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { ApexChart, CHANNEL_COLORS, CHANNEL_LABELS, useChartTheme } from "@/components/business-reports/chart";
import { fmt$, fmt$2, fmtNum, fmtPct, perStoreDay, share } from "@/components/business-reports/report-format";
import type { ChannelKey, HourlyRow, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrHourlyChannelsCard — V1 "Hourly Sales by Channel" over the range.
 *  Hourly: stacked bars per channel, summed over every store-day, or averaged
 *  per store-day (each hour's own `store_days`). By Channel: one bar per
 *  channel from the range totals. Legend chips hide/show channels.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_HOURLY_CHANNELS_SPAN: V1Span = 2;

type ChannelId = "register" | ChannelKey;
type Tab = "hourly" | "channel";
type Mode = "sum" | "avg";

const CHANNEL_IDS: ChannelId[] = [
  "register",
  "phone",
  "website",
  "mobile",
  "doordash",
  "ubereats",
  "grubhub",
  "call_center",
  "drive_thru",
];

const CHART_HEIGHT = 200;
const BAR_RADIUS = 2;
const LABEL_ROTATE = -45;
const NOON = 12;
const EMPTY_COLOR = "#94a3b8";
const HIDDEN_DOT = "#71717a";

const salesKey = (c: ChannelId) => `${c}_sales` as const;

const compact$ = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < NOON) return `${h} AM`;
  if (h === NOON) return "12 PM";
  return `${h - NOON} PM`;
}

function hourTotal(r: HourlyRow): number {
  return CHANNEL_IDS.reduce((s, c) => s + (Number(r[salesKey(c)]) || 0), 0);
}

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "channel", label: "By Channel" },
];
const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Avg" },
];

export function BrHourlyChannelsCard({ data }: { data: SalesSection }) {
  const theme = useChartTheme();
  const [tab, setTab] = useState<Tab>("hourly");
  const [mode, setMode] = useState<Mode>("sum");
  const [hidden, setHidden] = useState<Set<ChannelId>>(() => new Set());
  const [open, setOpen] = useState(false);
  const isChannel = tab === "channel";
  const isAvg = mode === "avg";

  const toggle = useCallback(
    (c: ChannelId) =>
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(c)) next.delete(c);
        else next.add(c);
        return next;
      }),
    [],
  );

  const hours = useMemo(() => [...data.hourly].sort((a, b) => a.hour - b.hour), [data.hourly]);

  const channelTotals = useMemo(
    () =>
      CHANNEL_IDS.map((c) => {
        const sum = Number(data.totals[salesKey(c)]) || 0;
        return { id: c, sum, avg: perStoreDay(sum, data.totals.store_days) };
      }),
    [data.totals],
  );
  const channelGrand = useMemo(() => channelTotals.reduce((s, c) => s + c.sum, 0), [channelTotals]);

  const hasData = useMemo<Record<ChannelId, boolean>>(
    () =>
      Object.fromEntries(
        CHANNEL_IDS.map((c) => [
          c,
          isChannel
            ? channelTotals.some((t) => t.id === c && t.sum > 0)
            : hours.some((h) => (Number(h[salesKey(c)]) || 0) !== 0),
        ]),
      ) as Record<ChannelId, boolean>,
    [isChannel, channelTotals, hours],
  );

  const visible = useMemo(() => CHANNEL_IDS.filter((c) => !hidden.has(c)), [hidden]);

  /* ── Hourly tab ─────────────────────────────────────────────────────── */
  const hourlySeries = useMemo(
    () =>
      visible.map((c) => ({
        name: CHANNEL_LABELS[c],
        data: hours.map((h) => {
          const v = Number(h[salesKey(c)]) || 0;
          return Math.round(isAvg ? perStoreDay(v, h.store_days) : v);
        }),
      })),
    [visible, hours, isAvg],
  );

  const hourlyOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        stacked: true,
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: theme.label,
      },
      theme: { mode: theme.mode },
      colors: visible.length > 0 ? visible.map((c) => CHANNEL_COLORS[c]) : [EMPTY_COLOR],
      plotOptions: { bar: { horizontal: false, borderRadius: BAR_RADIUS } },
      dataLabels: { enabled: false },
      stroke: { width: 1, colors: [theme.isDark ? "#27272a" : "#ffffff"] },
      xaxis: {
        categories: hours.map((h) => formatHour(h.hour)),
        labels: { rotate: LABEL_ROTATE, style: { fontSize: "8.5px", colors: theme.label } },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: {
        min: 0,
        labels: { formatter: (v: number) => compact$.format(v), style: { fontSize: "9px", colors: theme.label } },
      },
      tooltip: { shared: true, intersect: false, theme: theme.mode, y: { formatter: (v: number) => fmt$2(v) } },
      legend: { show: false },
      grid: { borderColor: theme.grid },
      fill: { opacity: 1 },
    }),
    [theme, visible, hours],
  );

  /* ── By Channel tab ─────────────────────────────────────────────────── */
  const visibleTotals = useMemo(
    () => channelTotals.filter((c) => !hidden.has(c.id)),
    [channelTotals, hidden],
  );
  const channelSeries = useMemo(
    () => [{ name: "Sales", data: visibleTotals.map((c) => Math.round(isAvg ? c.avg : c.sum)) }],
    [visibleTotals, isAvg],
  );
  const channelOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: theme.label,
      },
      theme: { mode: theme.mode },
      colors: visibleTotals.length > 0 ? visibleTotals.map((c) => CHANNEL_COLORS[c.id]) : [EMPTY_COLOR],
      plotOptions: { bar: { horizontal: false, borderRadius: BAR_RADIUS, distributed: true, columnWidth: "60%" } },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      xaxis: {
        categories: visibleTotals.map((c) => CHANNEL_LABELS[c.id]),
        labels: { rotate: LABEL_ROTATE, trim: true, style: { fontSize: "8.5px", colors: theme.label } },
        axisBorder: { color: theme.axis },
        axisTicks: { color: theme.axis },
      },
      yaxis: {
        min: 0,
        labels: { formatter: (v: number) => compact$.format(v), style: { fontSize: "9px", colors: theme.label } },
      },
      tooltip: {
        theme: theme.mode,
        y: {
          formatter: (v: number, opts?: { dataPointIndex?: number }) => {
            const row = visibleTotals[opts?.dataPointIndex ?? 0];
            return `${fmt$2(v)} (${fmtPct(share(row?.sum ?? 0, channelGrand))})`;
          },
        },
      },
      legend: { show: false },
      grid: { borderColor: theme.grid },
      fill: { opacity: 1 },
    }),
    [theme, visibleTotals, channelGrand],
  );

  const renderChart = () => {
    if (visible.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
          No channels selected
        </div>
      );
    }
    if (isChannel && channelGrand === 0) {
      return (
        <div className="flex-1 px-3">
          <V1Empty icon={BarChart2}>No channel sales in this range</V1Empty>
        </div>
      );
    }
    if (!isChannel && hours.length === 0) {
      return (
        <div className="flex-1 px-3">
          <V1Empty icon={BarChart2}>No hourly sales in this range</V1Empty>
        </div>
      );
    }
    return (
      <div className="min-h-0 flex-1">
        <ApexChart
          key={`${tab}-${mode}-${theme.key}`}
          options={isChannel ? channelOptions : hourlyOptions}
          series={isChannel ? channelSeries : hourlySeries}
          type="bar"
          height={CHART_HEIGHT}
        />
      </div>
    );
  };

  return (
    <V1Card
      reportId="br-hourly-channels"
      title={isChannel ? "Sales by Channel" : "Hourly Sales by Channel"}
      category="sales"
      period="R"
      showPeriodBadge={false}
      span={BR_HOURLY_CHANNELS_SPAN}
      className="h-auto !overflow-visible sm:h-[280px]"
      bodyClassName="!overflow-visible !p-0 flex flex-col"
      onExpand={() => setOpen(true)}
      headerControl={
        <div className="ms-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <V1Toggle<Tab> options={TAB_OPTIONS} value={tab} onChange={setTab} />
          <V1Toggle<Mode> options={MODE_OPTIONS} value={mode} onChange={setMode} />
        </div>
      }
    >
      <div className="flex shrink-0 flex-wrap gap-y-0.5 px-2.5 py-1" onClick={(e) => e.stopPropagation()}>
        {CHANNEL_IDS.map((c) => {
          const isHidden = hidden.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              aria-pressed={!isHidden}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-medium transition-all",
                isHidden ? "text-muted-foreground opacity-30" : "opacity-100",
              )}
              style={isHidden ? undefined : { color: CHANNEL_COLORS[c] }}
            >
              {hasData[c] ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isHidden ? HIDDEN_DOT : CHANNEL_COLORS[c] }}
                />
              ) : (
                <span className="text-[8px] text-red-500 dark:text-red-400">!</span>
              )}
              {CHANNEL_LABELS[c]}
            </button>
          );
        })}
        {isAvg && (
          <span className="ms-auto self-center text-[8.5px] text-muted-foreground">per store-day</span>
        )}
      </div>

      {renderChart()}

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Sales by Hour and Channel"
        badgeText={`${fmtNum(data.totals.store_days)} store-days`}
      >
        {open && <HourlyDetail hours={hours} channelTotals={channelTotals} channelGrand={channelGrand} initialTab={tab} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

/* ── Expand dialog body — mounted only while open ────────────────────────── */

function HourlyDetail({
  hours,
  channelTotals,
  channelGrand,
  initialTab,
}: {
  hours: HourlyRow[];
  channelTotals: { id: ChannelId; sum: number; avg: number }[];
  channelGrand: number;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const hourRows = useMemo(() => {
    const totals = hours.map((h) => ({ hour: h.hour, storeDays: h.store_days, total: hourTotal(h) }));
    const grand = totals.reduce((s, r) => s + r.total, 0);
    return totals.map((r) => ({ ...r, avg: perStoreDay(r.total, r.storeDays), pct: share(r.total, grand) }));
  }, [hours]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <V1Toggle<Tab> options={TAB_OPTIONS} value={tab} onChange={setTab} />
      </div>
      {tab === "hourly" ? (
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Hour</th>
              <th className={cn(V1_TH, V1_NUM)}>Total</th>
              <th className={cn(V1_TH, V1_NUM)}>Avg / store-day</th>
              <th className={cn(V1_TH, V1_NUM)}>Store-days</th>
              <th className={cn(V1_TH, V1_NUM)}>Share</th>
            </tr>
          </thead>
          <tbody>
            {hourRows.map((r) => (
              <tr key={r.hour}>
                <td className={cn(V1_TD, "font-medium")}>{formatHour(r.hour)}</td>
                <td className={cn(V1_TD, V1_NUM, "font-semibold")}>{fmt$(r.total)}</td>
                <td className={cn(V1_TD, V1_NUM)}>{fmt$2(r.avg)}</td>
                <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtNum(r.storeDays)}</td>
                <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtPct(r.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Channel</th>
              <th className={cn(V1_TH, V1_NUM)}>Sales</th>
              <th className={cn(V1_TH, V1_NUM)}>Avg / store-day</th>
              <th className={cn(V1_TH, V1_NUM)}>Share</th>
            </tr>
          </thead>
          <tbody>
            {channelTotals.map((c) => (
              <tr key={c.id}>
                <td className={cn(V1_TD, "font-medium")}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[c.id] }} />
                    {CHANNEL_LABELS[c.id]}
                  </span>
                </td>
                <td className={cn(V1_TD, V1_NUM, "font-semibold")}>{fmt$(c.sum)}</td>
                <td className={cn(V1_TD, V1_NUM)}>{fmt$2(c.avg)}</td>
                <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>{fmtPct(share(c.sum, channelGrand))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
