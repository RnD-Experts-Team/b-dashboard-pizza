"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import type { ApexOptions } from "apexcharts";
import type { HourlySalesChannel, DsprChannelSales } from "@/types/dspr.types";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";
import { V1Card } from "../v1-card";
import { V1Toggle, V1Empty } from "../v1-ui";
import { WtdComparisonDialog } from "@/components/dspr/wtd-comparison-dialog";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});

/** Which chart this card is showing — hourly buckets, or whole-period channel totals. */
type ChannelTab = "hourly" | "channel";

/* ── Channel definitions — exact same colors as the original chart ──────────
 * `key`      → field on HourlySalesChannel (hourly tab)
 * `salesKey` → field on DsprChannelSales   (channel-totals tab)
 * They differ only for Register; keeping both here means one label+color source
 * for both tabs, so the same channel never renders in two different colors. */
const CHANNEL_KEYS: {
  key: keyof HourlySalesChannel;
  salesKey: keyof DsprChannelSales;
  label: string;
  color: string;
}[] = [
  { key: "adjusted_royalty_obligation", salesKey: "royalty_obligation", label: "Register",   color: "#F97316" },
  { key: "phone_sales",                 salesKey: "phone_sales",        label: "Phone",       color: "#008FFB" },
  { key: "website_sales",               salesKey: "website_sales",      label: "Website",     color: "#00E396" },
  { key: "mobile_sales",                salesKey: "mobile_sales",       label: "Mobile",      color: "#FEB019" },
  { key: "doordash_sales",              salesKey: "doordash_sales",     label: "DoorDash",    color: "#FF4560" },
  { key: "ubereats_sales",              salesKey: "ubereats_sales",     label: "UberEats",    color: "#775DD0" },
  { key: "grubhub_sales",               salesKey: "grubhub_sales",      label: "Grubhub",     color: "#546E7A" },
  { key: "call_center_sales",           salesKey: "call_center_sales",  label: "Call Center", color: "#26a69a" },
  { key: "drive_thru_sales",            salesKey: "drive_thru_sales",   label: "Drive-Thru",  color: "#D10CE8" },
];

function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

/* ── Shared Today vs WTD comparison table — used for both the hourly and the
 * per-channel dialog views, which share the same {label, dayTotal, wtdTotal}
 * shape and diff/arrow rendering. ─────────────────────────────────────────── */
function CompTable({
  firstColLabel,
  rows,
}: {
  firstColLabel: string;
  rows: { key: string | number; label: string; dayTotal: number; wtdTotal: number }[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {firstColLabel}
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Today
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              WTD Avg
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const diff      = row.dayTotal - row.wtdTotal;
            const direction = Math.abs(diff) < 0.01 ? "same" : diff > 0 ? "up" : "down";
            const pct       =
              row.wtdTotal !== 0
                ? `${diff >= 0 ? "+" : ""}${((diff / Math.abs(row.wtdTotal)) * 100).toFixed(1)}%`
                : null;
            return (
              <tr
                key={row.key}
                className={cn(
                  "border-b last:border-0 transition-colors hover:bg-muted/30",
                  i % 2 === 1 && "bg-muted/20",
                )}
              >
                <td className="px-4 py-2 font-medium">{row.label}</td>
                <td className="px-4 py-2 text-right tabular-nums font-mono text-emerald-700 dark:text-emerald-300">
                  ${row.dayTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-mono">
                  ${row.wtdTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-right">
                  {direction !== "same" && pct ? (
                    <span
                      className={cn(
                        "inline-flex items-center justify-end gap-0.5 text-[10px] font-semibold",
                        diff > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {diff > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {pct}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Card ────────────────────────────────────────────────────────────────── */
export function V1HourlyChannelsCard({
  hourly,
  weekly,
  channelToday,
  channelWeekly,
  span,
  className,
}: {
  hourly: HourlySalesChannel[];
  weekly?: HourlySalesChannel[];
  /** Whole-period channel totals for the "By Channel" tab. */
  channelToday?: DsprChannelSales;
  /** WTD-avg channel totals for the "By Channel" tab. */
  channelWeekly?: DsprChannelSales;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const isDark = useDocumentColorMode() === "dark";
  // Each tab has its own WTD source, so the Day/WTD toggle is offered per tab.
  const hasHourlyWeekly = Boolean(weekly?.length);
  const hasChannelWeekly = Boolean(channelWeekly);

  const [chanTab, setChanTab]      = useState<ChannelTab>("hourly");
  const [view, setView]            = useState<"day" | "wtd">("day");
  const [hiddenSeries, setHidden]  = useState<Set<string>>(new Set());
  const [dialogOpen, setDialog]    = useState(false);
  // Independent from the card's own tab — which comparison the dialog shows.
  const [dialogTab, setDialogTab]  = useState<ChannelTab>("hourly");

  const isChannelTab = chanTab === "channel";
  const hasWeekly = isChannelTab ? hasChannelWeekly : hasHourlyWeekly;
  // Guard against a stale "wtd" selection when switching to a tab that has no WTD data.
  const effectiveView = view === "wtd" && hasWeekly ? "wtd" : "day";

  const toggle = useCallback((label: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }, []);

  // Ctrl/Cmd+click a legend item to isolate it (hide every other channel).
  // Ctrl/Cmd+click the already-isolated item again to restore all channels.
  const isolate = useCallback((label: string) => {
    setHidden((prev) => {
      const others = CHANNEL_KEYS.map((c) => c.label).filter((l) => l !== label);
      const alreadyIsolated = !prev.has(label) && others.every((l) => prev.has(l));
      return alreadyIsolated ? new Set() : new Set(others);
    });
  }, []);

  /* ── Hourly tab shaping — same logic as original ──────────────────────── */
  const { series, categories, channelHasData } = useMemo(() => {
    const src = effectiveView === "wtd" && weekly ? weekly : hourly;
    const sorted = [...src].sort((a, b) => a.hour - b.hour);

    const cats = sorted.map((r) => formatHour(r.hour));

    const hasDataByChannel = CHANNEL_KEYS.reduce<Record<string, boolean>>(
      (acc, { key, label }) => {
        acc[label] = sorted.some((r) => hasUsableValue(r[key]));
        return acc;
      },
      {},
    );

    const s = CHANNEL_KEYS.map(({ key, label }) => ({
      name: label,
      data: sorted.map((r) => Number(r[key]) || 0),
    }));

    return { series: s, categories: cats, channelHasData: hasDataByChannel };
  }, [effectiveView, weekly, hourly]);

  /* ── Channel-totals tab shaping ───────────────────────────────────────── */
  const channelTotals = useMemo(() => {
    const src = effectiveView === "wtd" && channelWeekly ? channelWeekly : channelToday;
    return CHANNEL_KEYS.map(({ salesKey, label, color }) => ({
      label,
      color,
      value: Number(src?.[salesKey]) || 0,
    }));
  }, [effectiveView, channelToday, channelWeekly]);

  /* Which channels have data, per active tab — drives the legend's red "!" mark. */
  const activeChannelHasData = useMemo(() => {
    if (!isChannelTab) return channelHasData;
    return channelTotals.reduce<Record<string, boolean>>((acc, c) => {
      acc[c.label] = c.value > 0;
      return acc;
    }, {});
  }, [isChannelTab, channelHasData, channelTotals]);

  /* ── Hourly comparison rows for the dialog ────────────────────────────── */
  const compRows = useMemo(() => {
    if (!weekly) return [];
    const allHours = Array.from(
      new Set([...hourly.map((h) => h.hour), ...weekly.map((h) => h.hour)]),
    ).sort((a, b) => a - b);
    const dayMap = new Map(hourly.map((h) => [h.hour, h]));
    const wtdMap = new Map(weekly.map((h) => [h.hour, h]));
    return allHours.map((hour) => {
      const d = dayMap.get(hour);
      const w = wtdMap.get(hour);
      const dayTotal = d ? CHANNEL_KEYS.reduce((s, { key }) => s + (Number(d[key]) || 0), 0) : 0;
      const wtdTotal = w ? CHANNEL_KEYS.reduce((s, { key }) => s + (Number(w[key]) || 0), 0) : 0;
      return { hour, label: formatHour(hour), dayTotal, wtdTotal };
    });
  }, [hourly, weekly]);

  /* ── Per-channel comparison rows for the dialog ───────────────────────── */
  const channelCompRows = useMemo(() => {
    return CHANNEL_KEYS.map(({ salesKey, label }) => ({
      label,
      dayTotal: Number(channelToday?.[salesKey]) || 0,
      wtdTotal: Number(channelWeekly?.[salesKey]) || 0,
    })).filter((r) => r.dayTotal > 0 || r.wtdTotal > 0);
  }, [channelToday, channelWeekly]);

  /* ── Visible series / colors ─────────────────────────────────────────── */
  const visibleKeys   = CHANNEL_KEYS.filter((c) => !hiddenSeries.has(c.label));
  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.name));
  const visibleColors = visibleKeys.map((c) => c.color);

  /* Channel tab: one bar per visible channel (single series, per-bar colors). */
  const visibleChannelTotals = channelTotals.filter((c) => !hiddenSeries.has(c.label));
  const channelSeries = useMemo(
    () => [{ name: "Sales", data: visibleChannelTotals.map((c) => c.value) }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleChannelTotals.map((c) => `${c.label}:${c.value}`).join(",")],
  );
  const channelCategories = visibleChannelTotals.map((c) => c.label);
  const channelColors = visibleChannelTotals.map((c) => c.color);
  const channelGrandTotal = channelTotals.reduce((s, c) => s + c.value, 0);

  const allHidden = isChannelTab
    ? visibleChannelTotals.length === 0
    : visibleSeries.length === 0;

  /* ── ApexCharts options — mirrors original exactly ────────────────────── */
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        stacked: true,
        toolbar: { show: false },
        animations: { enabled: true, speed: 350 },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: visibleColors.length > 0 ? visibleColors : ["#94a3b8"],
      plotOptions: {
        bar: {
          horizontal: false,
          borderRadius: 2,
          dataLabels: {
            total: {
              enabled: false,
              style: {
                fontSize: "10px",
                fontWeight: 700,
                color: isDark ? "#d4d4d8" : "#3f3f46",
              },
              formatter: (val: string) => `$${parseFloat(val).toFixed(0)}`,
            },
          },
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 1, colors: [isDark ? "#27272a" : "#ffffff"] },
      xaxis: {
        categories,
        labels: {
          style: { fontSize: "8.5px", colors: isDark ? "#a1a1aa" : "#71717a" },
          rotate: -45,
          rotateAlways: false,
        },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks:  { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (v: number) => `$${v.toFixed(0)}`,
          style: { fontSize: "9px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        theme: isDark ? "dark" : "light",
        y: {
          formatter: (val: number) =>
            `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
      legend: { show: false },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      fill: { opacity: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, visibleColors.join(","), categories.join(",")],
  );

  /* ── Channel-totals options — same chart, one distributed bar per channel ── */
  const channelOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        stacked: false,
        toolbar: { show: false },
        animations: { enabled: true, speed: 350 },
        fontFamily: "inherit",
        background: "transparent",
        foreColor: isDark ? "#a1a1aa" : "#71717a",
      },
      theme: { mode: isDark ? "dark" : "light" },
      colors: channelColors.length > 0 ? channelColors : ["#94a3b8"],
      plotOptions: {
        bar: { horizontal: false, borderRadius: 2, distributed: true, columnWidth: "60%" },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      xaxis: {
        categories: channelCategories,
        labels: {
          style: { fontSize: "8.5px", colors: isDark ? "#a1a1aa" : "#71717a" },
          rotate: -45,
          rotateAlways: false,
          trim: true,
        },
        axisBorder: { color: isDark ? "#3f3f46" : "#e4e4e7" },
        axisTicks:  { color: isDark ? "#3f3f46" : "#e4e4e7" },
      },
      yaxis: {
        min: 0,
        labels: {
          formatter: (v: number) => `$${v.toFixed(0)}`,
          style: { fontSize: "9px", colors: isDark ? "#a1a1aa" : "#71717a" },
        },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        y: {
          formatter: (val: number) => {
            const pct = channelGrandTotal > 0 ? (val / channelGrandTotal) * 100 : 0;
            return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${pct.toFixed(1)}%)`;
          },
        },
      },
      legend: { show: false },
      grid: { borderColor: isDark ? "#27272a" : "#e4e4e7" },
      fill: { opacity: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, channelColors.join(","), channelCategories.join(","), channelGrandTotal],
  );

  return (
    <V1Card
      title={isChannelTab ? "Sales by Channel" : "Hourly Sales by Channel"}
      category="sales"
      period={hasWeekly ? "D·WTD" : "D"}
      showPeriodBadge={false}
      span={span}
      className={cn("!overflow-visible", className)}
      bodyClassName="!overflow-visible !p-0 flex flex-col"
      onExpand={
        hasHourlyWeekly || hasChannelWeekly
          ? () => {
              setDialogTab(chanTab);
              setDialog(true);
            }
          : undefined
      }
      headerControl={
        <div
          className="flex flex-wrap items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <V1Toggle
            options={[
              { value: "hourly", label: "Hourly" },
              { value: "channel", label: "By Channel" },
            ]}
            value={chanTab}
            onChange={(v) => setChanTab(v as ChannelTab)}
          />
          {hasWeekly && (
            <V1Toggle
              options={[
                { value: "day", label: "Day" },
                { value: "wtd", label: "WTD" },
              ]}
              value={effectiveView}
              onChange={(v) => setView(v as "day" | "wtd")}
            />
          )}
        </div>
      }
    >
      {/* Legend — stop propagation so clicks don't open dialog */}
      <div
        className="flex flex-wrap gap-x-0 gap-y-0.5 px-2.5 py-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {CHANNEL_KEYS.map((ch) => {
          const isHidden = hiddenSeries.has(ch.label);
          const hasData  = activeChannelHasData[ch.label];
          return (
            <button
              key={ch.label}
              type="button"
              onClick={(e) => (e.ctrlKey || e.metaKey ? isolate(ch.label) : toggle(ch.label))}
              className={cn(
                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-medium transition-all",
                isHidden ? "opacity-30 text-muted-foreground" : "opacity-100",
              )}
              style={isHidden ? undefined : { color: ch.color }}
            >
              {hasData ? (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: isHidden ? "#71717a" : ch.color }}
                />
              ) : (
                <span className="text-[8px] text-red-400">!</span>
              )}
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {allHidden ? (
        <div className="flex flex-1 items-center justify-center text-[11px] text-muted-foreground">
          No channels selected
        </div>
      ) : isChannelTab ? (
        channelGrandTotal === 0 ? (
          <div className="flex-1 px-3">
            <V1Empty icon={BarChart2}>No channel sales data for this period</V1Empty>
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <ReactApexChart
              key={`channel-${isDark ? "dark" : "light"}-${effectiveView}`}
              options={channelOptions}
              series={channelSeries}
              type="bar"
              height={200}
            />
          </div>
        )
      ) : (
        <div className="flex-1 min-h-0">
          <ReactApexChart
            key={`${isDark ? "dark" : "light"}-${effectiveView}`}
            options={options}
            series={visibleSeries}
            type="bar"
            height={200}
          />
        </div>
      )}

      {/* Comparison dialog — toggle between the hourly and per-channel breakdowns */}
      {(hasHourlyWeekly || hasChannelWeekly) && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialog(false)}
          title={dialogTab === "hourly" ? "Hourly Sales by Channel" : "Sales by Channel"}
        >
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <V1Toggle
              options={[
                { value: "hourly", label: "Hourly" },
                { value: "channel", label: "By Channel" },
              ]}
              value={dialogTab}
              onChange={(v) => setDialogTab(v as ChannelTab)}
            />
          </div>

          {dialogTab === "hourly" ? (
            compRows.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-muted-foreground">
                No hourly comparison data available.
              </p>
            ) : (
              <CompTable
                firstColLabel="Hour"
                rows={compRows.map((r) => ({
                  key: r.hour,
                  label: r.label,
                  dayTotal: r.dayTotal,
                  wtdTotal: r.wtdTotal,
                }))}
              />
            )
          ) : channelCompRows.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-muted-foreground">
              No channel comparison data available.
            </p>
          ) : (
            <CompTable
              firstColLabel="Channel"
              rows={channelCompRows.map((r) => ({
                key: r.label,
                label: r.label,
                dayTotal: r.dayTotal,
                wtdTotal: r.wtdTotal,
              }))}
            />
          )}
        </WtdComparisonDialog>
      )}
    </V1Card>
  );
}
