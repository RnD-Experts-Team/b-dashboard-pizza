"use client";

import { useCallback, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { ApexChart, CHANNEL_COLORS, CHANNEL_LABELS, useChartTheme } from "@/components/business-reports/chart";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { fmt$, fmt$2, fmtNum, fmtPct, perStoreDay, share } from "@/components/business-reports/report-format";
import { BarList, TrendChart, type BarRow } from "@/components/business-reports/cards/sales/br-dialog-kit";
import type { ChannelKey, HourlyRow, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrHourlyChannelsCard — V1 "Hourly Sales by Channel" over the range.
 *  Hourly: stacked bars per channel, summed over every store-day, or averaged
 *  per store-day (each hour's own `store_days`). By Channel: one bar per
 *  channel from the range totals. Legend chips hide/show channels.
 *  Expand: the stacked hourly chart large, every hour, the channel mix.
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
const HOURS_PER_DAY = 24;
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

      {open && (
        <HourlyDialog
          data={data}
          hours={hours}
          channelTotals={channelTotals}
          channelGrand={channelGrand}
          onClose={() => setOpen(false)}
        />
      )}
    </V1Card>
  );
}

/* ── Expand dialog — mounted only while open ─────────────────────────────── */

interface HourRow {
  hour: number;
  storeDays: number;
  total: number;
  avg: number;
  pct: number;
}

interface ChannelTotal {
  id: ChannelId;
  sum: number;
  avg: number;
}

const HOUR_COLUMNS: PagedColumn<HourRow>[] = [
  { key: "hour", header: "Hour", sortValue: (r) => r.hour, render: (r) => <span className="font-medium">{formatHour(r.hour)}</span> },
  { key: "total", header: "Sales", numeric: true, sortValue: (r) => r.total, render: (r) => <span className="font-semibold">{fmt$(r.total)}</span> },
  { key: "avg", header: "Avg / store-day", numeric: true, sortValue: (r) => r.avg, render: (r) => fmt$2(r.avg) },
  { key: "days", header: "Store-days", numeric: true, sortValue: (r) => r.storeDays, render: (r) => fmtNum(r.storeDays) },
  { key: "pct", header: "Share", numeric: true, sortValue: (r) => r.pct, render: (r) => fmtPct(r.pct) },
];

function HourlyDialog({
  data,
  hours,
  channelTotals,
  channelGrand,
  onClose,
}: {
  data: SalesSection;
  hours: HourlyRow[];
  channelTotals: ChannelTotal[];
  channelGrand: number;
  onClose: () => void;
}) {
  const hourRows = useMemo<HourRow[]>(() => {
    const totals = hours.map((h) => ({ hour: h.hour, storeDays: h.store_days, total: hourTotal(h) }));
    const grand = totals.reduce((s, r) => s + r.total, 0);
    return totals.map((r) => ({ ...r, avg: perStoreDay(r.total, r.storeDays), pct: share(r.total, grand) }));
  }, [hours]);

  const peak = useMemo(
    () => hourRows.reduce<HourRow | null>((a, r) => (a === null || r.total > a.total ? r : a), null),
    [hourRows],
  );
  const ranked = useMemo(() => [...channelTotals].sort((a, b) => b.sum - a.sum), [channelTotals]);
  const topChannel = ranked[0] && ranked[0].sum > 0 ? ranked[0] : null;

  const chart = useMemo(() => {
    const withData = CHANNEL_IDS.filter((c) => hours.some((h) => (Number(h[salesKey(c)]) || 0) !== 0));
    return {
      categories: hours.map((h) => formatHour(h.hour)),
      bars: withData.map((c) => ({
        name: CHANNEL_LABELS[c],
        data: hours.map((h) => Math.round(Number(h[salesKey(c)]) || 0)),
        color: CHANNEL_COLORS[c],
      })),
    };
  }, [hours]);

  const mix = useMemo<BarRow[]>(
    () =>
      ranked.map((c) => ({
        key: c.id,
        label: CHANNEL_LABELS[c.id],
        value: c.sum,
        display: fmt$(c.sum),
        sub: `${fmtPct(share(c.sum, channelGrand))} · ${fmt$2(c.avg)} / store-day`,
        color: CHANNEL_COLORS[c.id],
      })),
    [ranked, channelGrand],
  );

  const stats: ReportStat[] = [
    { label: "Sales", value: fmt$(channelGrand), sub: `${fmtNum(data.totals.store_days)} store-days` },
    { label: "Per store-day", value: fmt$2(perStoreDay(channelGrand, data.totals.store_days)) },
    { label: "Peak hour", value: peak ? formatHour(peak.hour) : "—", sub: peak ? `${fmt$(peak.total)} · ${fmtPct(peak.pct)}` : undefined },
    {
      label: "Top channel",
      value: topChannel ? CHANNEL_LABELS[topChannel.id] : "—",
      sub: topChannel ? `${fmt$(topChannel.sum)} · ${fmtPct(share(topChannel.sum, channelGrand))}` : undefined,
    },
  ];

  const tabs = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <ReportBlock title="Sales by hour, stacked by channel" description="Summed over every store-day in the range">
          {chart.bars.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hourly sales in this range</p>
          ) : (
            <TrendChart categories={chart.categories} bars={chart.bars} stacked />
          )}
        </ReportBlock>
      ),
    },
    {
      key: "hours",
      label: "By hour",
      content: (
        <ReportBlock title="Every hour" description="Avg / store-day divides by the store-days that had sales at that hour">
          <PagedTable size="lg" rows={hourRows} columns={HOUR_COLUMNS} rowKey={(r) => r.hour} initialSort="hour" initialDir="asc" pageSize={HOURS_PER_DAY} />
        </ReportBlock>
      ),
    },
    {
      key: "channels",
      label: "By channel",
      content: (
        <ReportBlock title="Channel mix" description="Range totals per channel, largest first">
          <BarList rows={mix} color={CHANNEL_COLORS.register} empty="No channel sales in this range" />
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
      title="Sales by Hour and Channel"
      category="sales"
      stats={stats}
      tabs={tabs}
    />
  );
}
