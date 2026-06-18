"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import type { ApexOptions } from "apexcharts";
import type { HourlySalesChannel } from "@/types/dspr.types";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDocumentColorMode } from "@/lib/theme/use-document-color-mode";
import { V1Card } from "../v1-card";
import { V1Toggle } from "../v1-ui";
import { WtdComparisonDialog } from "@/components/dspr/wtd-comparison-dialog";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});

/* ── Channel definitions — exact same colors as the original chart ────────── */
const CHANNEL_KEYS: { key: keyof HourlySalesChannel; label: string; color: string }[] = [
  { key: "adjusted_royalty_obligation", label: "Register",   color: "#F97316" },
  { key: "phone_sales",                 label: "Phone",       color: "#008FFB" },
  { key: "website_sales",               label: "Website",     color: "#00E396" },
  { key: "mobile_sales",                label: "Mobile",      color: "#FEB019" },
  { key: "doordash_sales",              label: "DoorDash",    color: "#FF4560" },
  { key: "ubereats_sales",              label: "UberEats",    color: "#775DD0" },
  { key: "grubhub_sales",               label: "Grubhub",     color: "#546E7A" },
  { key: "call_center_sales",           label: "Call Center", color: "#26a69a" },
  { key: "drive_thru_sales",            label: "Drive-Thru",  color: "#D10CE8" },
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

/* ── Card ────────────────────────────────────────────────────────────────── */
export function V1HourlyChannelsCard({
  hourly,
  weekly,
  span,
  className,
}: {
  hourly: HourlySalesChannel[];
  weekly?: HourlySalesChannel[];
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const isDark = useDocumentColorMode() === "dark";
  const hasWeekly = Boolean(weekly?.length);

  const [view, setView]           = useState<"day" | "wtd">("day");
  const [hiddenSeries, setHidden] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialog]   = useState(false);

  const toggle = useCallback((label: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }, []);

  /* ── Data shaping — same logic as original ────────────────────────────── */
  const { series, categories, channelHasData } = useMemo(() => {
    const src = view === "wtd" && weekly ? weekly : hourly;
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
  }, [view, weekly, hourly]);

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

  /* ── Visible series / colors ─────────────────────────────────────────── */
  const visibleKeys   = CHANNEL_KEYS.filter((c) => !hiddenSeries.has(c.label));
  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.name));
  const visibleColors = visibleKeys.map((c) => c.color);
  const allHidden     = visibleSeries.length === 0;

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

  return (
    <V1Card
      title="Hourly Sales by Channel"
      category="sales"
      period={hasWeekly ? "D·WTD" : "D"}
      span={span}
      className={cn("!overflow-visible", className)}
      bodyClassName="!overflow-visible !p-0 flex flex-col"
      onExpand={hasWeekly ? () => setDialog(true) : undefined}
      headerControl={
        hasWeekly ? (
          <V1Toggle
            className="ms-1"
            options={[
              { value: "day", label: "Day" },
              { value: "wtd", label: "WTD" },
            ]}
            value={view}
            onChange={(v) => setView(v as "day" | "wtd")}
          />
        ) : undefined
      }
    >
      {/* Legend — stop propagation so clicks don't open dialog */}
      <div
        className="flex flex-wrap gap-x-0 gap-y-0.5 px-2.5 py-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {CHANNEL_KEYS.map((ch) => {
          const isHidden = hiddenSeries.has(ch.label);
          const hasData  = channelHasData[ch.label];
          return (
            <button
              key={ch.label}
              type="button"
              onClick={() => toggle(ch.label)}
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
      ) : (
        <div className="flex-1 min-h-0">
          <ReactApexChart
            key={`${isDark ? "dark" : "light"}-${view}`}
            options={options}
            series={visibleSeries}
            type="bar"
            height={200}
          />
        </div>
      )}

      {/* Comparison dialog */}
      {hasWeekly && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialog(false)}
          title="Hourly Sales by Channel"
        >
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Hour
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
                {compRows.map((row, i) => {
                  const diff      = row.dayTotal - row.wtdTotal;
                  const direction = Math.abs(diff) < 0.01 ? "same" : diff > 0 ? "up" : "down";
                  const pct       =
                    row.wtdTotal !== 0
                      ? `${diff >= 0 ? "+" : ""}${((diff / Math.abs(row.wtdTotal)) * 100).toFixed(1)}%`
                      : null;
                  return (
                    <tr
                      key={row.hour}
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
        </WtdComparisonDialog>
      )}
    </V1Card>
  );
}
