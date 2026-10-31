"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { BarChart3, Table2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { AnalyticsCard } from "@/components/maintenance-tickets/analytics/analytics-card";

/** ApexCharts only in the browser, with a skeleton while it loads (CLAUDE.md "Charts"). */
export const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full" />,
});

/**
 * The colours of maintenance money: the Dashboard V1 `finance` ramp (money
 * spent) and `people` ramp (who it went to). ApexCharts wants literal hex.
 */
export const FINANCE = CATEGORIES.finance.chartColors;
export const PEOPLE = CATEGORIES.people.chartColors;

/** Text, axis and grid colours for the current theme (Apex can't read CSS variables). */
export function useChartInk() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    dark,
    fore: dark ? "#a1a1aa" : "#52525b",
    grid: dark ? "#3f3f46" : "#e4e4e7",
    tooltip: (dark ? "dark" : "light") as "dark" | "light",
  };
}

/**
 * Every chart sits in one of these: the analytics card shell plus a
 * "Show as table" / "Show as chart" toggle (rule 12: every chart has a table
 * alternative). `chart` and `table` are render functions, so only the one on
 * screen is built.
 */
export function ChartCard({
  id,
  icon,
  title,
  description,
  chart,
  table,
  extra,
  className,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  chart: () => ReactNode;
  table: () => ReactNode;
  /** A small label beside the toggle (e.g. "By week"). */
  extra?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem.common");
  const [asTable, setAsTable] = useState(false);
  return (
    <AnalyticsCard
      id={id}
      icon={icon}
      title={title}
      description={description}
      className={className}
      action={
        <div className="flex items-center gap-2">
          {extra}
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <BarChart3 className="me-1.5 h-4 w-4" aria-hidden="true" /> : <Table2 className="me-1.5 h-4 w-4" aria-hidden="true" />}
            {asTable ? t("showAsChart") : t("showAsTable")}
          </Button>
        </div>
      }
    >
      {asTable ? table() : chart()}
    </AnalyticsCard>
  );
}

/** Compact table classes used by every "Show as table". */
export const TH = "whitespace-nowrap px-3 py-2 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground";
export const TD = "px-3 py-2 align-middle";

/** A plain two-or-more column table for a chart's numbers. */
export function DataTable({
  head,
  rows,
  numeric,
}: {
  head: string[];
  rows: ReactNode[][];
  /** Column indexes that hold numbers (right-aligned, tabular). */
  numeric: number[];
}) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={numeric.includes(i) ? `${TH} text-end` : TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((cells, r) => (
            <tr key={r}>
              {cells.map((c, i) => (
                <td key={i} className={numeric.includes(i) ? `${TD} text-end tabular-nums` : TD}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The "nothing in this range" line inside a chart card. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
