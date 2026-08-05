"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";
import type { LucideIcon } from "lucide-react";

/**
 * Apex must not render on the server — same idiom as components/dspr/sales-chart.tsx.
 *
 * The loading fallback fills its container (`h-full`) rather than using a
 * fixed height, so it always matches whatever size the real chart will
 * render at once the module resolves — a fixed-height skeleton here caused a
 * visible shrink-then-grow jump on first load, since each chart's actual
 * height differs (some fill their container, some are a fixed pixel value).
 */
export const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[120px] w-full" />,
});

/** The Labor Dashboard lives entirely in the "People & Labor" category. */
export const PEOPLE = CATEGORIES.people;

/**
 * Shared Apex base so every chart on the page reads the same in both themes.
 *
 * Returns `isDark` alongside the options because ApexCharts' own
 * `theme.mode` / `tooltip.theme` do not reliably restyle the tooltip on a
 * theme change — components/dspr/sales-chart.tsx works around the same
 * limitation with a hand-built `tooltip.custom` (see `buildTooltipCustom`
 * below). Callers should always render their tooltip via that helper instead
 * of trusting `tooltip.theme`.
 */
export function useChartBase(): { base: ApexOptions; isDark: boolean } {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "#a1a1aa" : "#71717a";
  const grid = isDark ? "#27272a" : "#e4e4e7";

  const base: ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      background: "transparent",
      animations: { enabled: true },
    },
    theme: { mode: isDark ? "dark" : "light" },
    grid: { borderColor: grid, strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: { labels: { colors: label } },
    xaxis: {
      labels: { style: { colors: label, fontSize: "10px" } },
      axisBorder: { color: grid },
      axisTicks: { color: grid },
    },
    yaxis: {
      labels: { style: { colors: label, fontSize: "10px" } },
    },
  };

  return { base, isDark };
}

/* ── Custom tooltip ────────────────────────────────────────────────────────
 *  ApexCharts' built-in tooltip theme option doesn't track the app's dark
 *  mode reliably, so every chart on this page renders its tooltip through
 *  this instead — same fix as sales-chart.tsx's `tooltip.custom`.
 * ────────────────────────────────────────────────────────────────────────── */

interface ApexTooltipCtx {
  series: Array<Array<number | null>>;
  seriesIndex: number;
  dataPointIndex: number;
  w: {
    globals: {
      labels?: string[];
      categoryLabels?: string[];
      colors?: string[];
      seriesNames?: string[];
    };
  };
}

export function buildTooltipCustom(opts: {
  isDark: boolean;
  formatValue: (v: number) => string;
}) {
  const { isDark, formatValue } = opts;
  const bg = isDark ? "#1a1a1e" : "#fff";
  const border = isDark ? "#333" : "#e4e4e7";
  const textColor = isDark ? "#e4e4e7" : "#333";
  const mutedColor = isDark ? "#a1a1aa" : "#71717a";

  return function custom({ series, seriesIndex, dataPointIndex, w }: ApexTooltipCtx) {
    const globals = w.globals;
    const cat =
      globals.categoryLabels?.[dataPointIndex] ?? globals.labels?.[dataPointIndex] ?? "";
    const val = series[seriesIndex]?.[dataPointIndex];
    const color = globals.colors?.[seriesIndex] ?? PEOPLE.chartColors[0];
    const seriesName = globals.seriesNames?.[seriesIndex];
    const valStr = val === null || val === undefined ? "No data" : formatValue(val);

    return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:8px 10px;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.12)">
      <div style="font-weight:600;font-size:11px;margin-bottom:4px;color:${textColor}">${cat}</div>
      <div style="display:flex;align-items:center;gap:6px;padding:2px 0">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
        ${seriesName ? `<span style="color:${mutedColor};font-size:11px">${seriesName}:</span>` : ""}
        <span style="font-weight:600;font-size:11px;color:${textColor}">${valStr}</span>
      </div>
    </div>`;
  };
}

/* ── Section card — the consistent shell every block on the page uses ────── */

export function LaborCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  fillHeight,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  /** Optional control rendered on the right of the header (toggle, search). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /**
   * When this card sits next to a taller sibling in a grid row, the grid
   * stretches the card's own height to match — but its content still only
   * takes up its natural size, leaving blank space below it. Set this to
   * make the content area grow and fill that stretched height instead;
   * the child is then responsible for using `flex-1` on whichever of its
   * own sections (e.g. a chart) should absorb the extra room.
   */
  fillHeight?: boolean;
}) {
  return (
    <Card
      className={cn("gap-0 py-3", fillHeight && "h-full", PEOPLE.cardBorder, className)}
    >
      <CardHeader className="shrink-0 px-3 pb-2 [.border-b]:pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide">
            {Icon && (
              <span className={cn("rounded p-0.5", PEOPLE.iconBg)}>
                <Icon className={cn("h-3.5 w-3.5", PEOPLE.text)} />
              </span>
            )}
            <span className={PEOPLE.headerText}>{title}</span>
          </CardTitle>
          {action && <div className="ms-auto">{action}</div>}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "px-3",
          fillHeight && "flex min-h-0 flex-1 flex-col",
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
