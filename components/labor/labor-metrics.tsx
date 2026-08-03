"use client";

import { useMemo, useState } from "react";
import { Banknote, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  V1Empty,
  V1Metric,
  V1_TBL,
  V1_TD,
  V1_TH,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";
import { cn } from "@/lib/utils";
import type { LaborMetrics as LaborMetricsData } from "@/types/labor.types";
import { LaborCard } from "./labor-chart";
import {
  fmtColumnValue,
  fmtCurrency,
  fmtHours,
  fmtNumber,
  fmtPercent,
  preferredStat,
} from "./labor-format";
import { useTableSort } from "./use-table-sort";

interface ColumnRow {
  key: string;
  label: string;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

type SortKey = "label" | "sum" | "avg" | "min" | "max" | "count";

function SortHeader({
  label,
  sortKey,
  activeKey,
  onSort,
  numeric,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  onSort: (k: SortKey) => void;
  numeric?: boolean;
}) {
  return (
    <th className={cn(V1_TH, numeric && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-0.5 hover:text-foreground",
          activeKey === sortKey && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="h-2.5 w-2.5" />
      </button>
    </th>
  );
}

export function LaborMetrics({ labor }: { labor: LaborMetricsData }) {
  const [query, setQuery] = useState("");
  const h = labor.highlights;

  // Whatever keys the API sent — never a hardcoded list, so a new CSV column
  // shows up here with no code change.
  const allRows: ColumnRow[] = useMemo(
    () =>
      Object.entries(labor.by_column).map(([key, stats]) => ({
        key,
        label: stats.label,
        sum: stats.sum,
        avg: stats.avg,
        min: stats.min,
        max: stats.max,
        count: stats.count,
      })),
    [labor.by_column],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.key.toLowerCase().includes(q),
    );
  }, [allRows, query]);

  const { sorted, sortKey, toggleSort } = useTableSort<ColumnRow, SortKey>(
    filtered,
    {
      label: (r) => r.label,
      sum: (r) => r.sum,
      avg: (r) => r.avg,
      min: (r) => r.min,
      max: (r) => r.max,
      count: (r) => r.count,
    },
    "label",
    "asc",
  );

  return (
    <LaborCard
      title="Labor & Performance"
      icon={Banknote}
      action={
        allRows.length > 0 ? (
          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search metrics…"
              className="h-7 w-40 ps-7 text-xs"
            />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Curated highlights — any of these can legitimately be null. */}
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
          <V1Metric label="Total Hours" value={fmtHours(h.total_hours)} size="lg" />
          <V1Metric
            label="Avg Hourly Pay"
            value={fmtCurrency(h.average_hourly_pay)}
            size="lg"
          />
          <V1Metric
            label="Total Gross Pay"
            value={fmtCurrency(h.total_gross_pay, 0)}
            size="lg"
          />
          <V1Metric
            label="Avg Gross / Employee"
            value={fmtCurrency(h.average_gross_pay_per_employee, 0)}
          />
          <V1Metric
            label="Labor %"
            value={fmtPercent(h.average_labor_percent)}
          />
          <V1Metric label="Total Sales" value={fmtCurrency(h.total_sales, 0)} />
          <V1Metric label="Total Tips" value={fmtCurrency(h.total_tips, 0)} />
          <V1Metric
            label="Avg Performance"
            value={fmtNumber(h.average_performance_score, 2)}
          />
          <V1Metric
            label="Avg Final Score"
            value={fmtNumber(h.average_final_score, 2)}
          />
        </div>

        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            All Metrics ({allRows.length})
          </p>
          {allRows.length === 0 ? (
            <V1Empty icon={Banknote}>No metric data recorded this week</V1Empty>
          ) : sorted.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">
              No metrics match “{query}”
            </p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border border-border/50">
              <table className={V1_TBL}>
                <thead>
                  <tr>
                    <SortHeader
                      label="Metric"
                      sortKey="label"
                      activeKey={sortKey}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="Sum"
                      sortKey="sum"
                      activeKey={sortKey}
                      onSort={toggleSort}
                      numeric
                    />
                    <SortHeader
                      label="Avg"
                      sortKey="avg"
                      activeKey={sortKey}
                      onSort={toggleSort}
                      numeric
                    />
                    <SortHeader
                      label="Min"
                      sortKey="min"
                      activeKey={sortKey}
                      onSort={toggleSort}
                      numeric
                    />
                    <SortHeader
                      label="Max"
                      sortKey="max"
                      activeKey={sortKey}
                      onSort={toggleSort}
                      numeric
                    />
                    <SortHeader
                      label="Readings"
                      sortKey="count"
                      activeKey={sortKey}
                      onSort={toggleSort}
                      numeric
                    />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const hint = preferredStat(r.key);
                    return (
                      <tr key={r.key} className="hover:bg-muted/40">
                        <td className={cn(V1_TD, "font-medium")}>{r.label}</td>
                        <td
                          className={cn(
                            V1_TD,
                            V1_NUM,
                            hint === "sum" && "font-bold text-foreground",
                            hint === "avg" && "text-muted-foreground",
                          )}
                        >
                          {fmtColumnValue(r.key, r.sum)}
                        </td>
                        <td
                          className={cn(
                            V1_TD,
                            V1_NUM,
                            hint === "avg" && "font-bold text-foreground",
                            hint === "sum" && "text-muted-foreground",
                          )}
                        >
                          {fmtColumnValue(r.key, r.avg)}
                        </td>
                        <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                          {fmtColumnValue(r.key, r.min)}
                        </td>
                        <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                          {fmtColumnValue(r.key, r.max)}
                        </td>
                        <td className={cn(V1_TD, V1_NUM, "text-muted-foreground")}>
                          {fmtNumber(r.count)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LaborCard>
  );
}
