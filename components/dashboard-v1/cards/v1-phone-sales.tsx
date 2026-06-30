"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PhoneAndAdjustedSales } from "@/types/dashboard-report.types";
import { fmt$, Delta, pctChangeOrNull, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Toggle, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1PhoneSalesCard — periods as rows, metrics as columns.
 *  Mirrors PeriodComparisonCard layout from the main dashboard.
 * ────────────────────────────────────────────────────────────────────────── */

type CmpMode = "previous" | "yoy";

const EMPTY_VALS = { phone_sales: 0, adjusted_royalty_obligation: 0 };

const METRICS = [
  { key: "phone_sales", label: "Phone", fmt: fmt$ },
  { key: "adjusted_royalty_obligation", label: "In Store", fmt: fmt$ },
] as const;

interface CmpGroup {
  label: string;
  current: Record<string, number>;
  baseline: Record<string, number>;
}

export function V1PhoneSalesCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: PhoneAndAdjustedSales;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [mode, setMode] = useState<CmpMode>("previous");

  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Phone & In-Store" category="sales" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, week, period, quarter, year } = data;
  const quarterNum = Math.ceil(filtering.period_number / 3);
  const yoy = mode === "yoy";

  const groups: CmpGroup[] = [
    {
      label: `Week ${filtering.week_number}`,
      current: { ...week.current } as Record<string, number>,
      baseline: { ...(yoy ? week.same_week_last_year ?? EMPTY_VALS : week.previous) } as Record<string, number>,
    },
    {
      label: `Period ${filtering.period_number}`,
      current: { ...period.current } as Record<string, number>,
      baseline: { ...(yoy ? period.same_period_last_year ?? EMPTY_VALS : period.previous) } as Record<string, number>,
    },
    {
      label: `Quarter ${quarterNum}`,
      current: { ...quarter.current } as Record<string, number>,
      baseline: { ...(yoy ? quarter.same_quarter_last_year ?? EMPTY_VALS : quarter.previous) } as Record<string, number>,
    },
    {
      label: "YTD",
      current: { ...year.current } as Record<string, number>,
      baseline: { ...year.previous } as Record<string, number>,
    },
  ];

  const baseLabel = yoy ? "Last Yr" : "Prev";

  return (
    <V1Card
      title="Phone & In-Store"
      category="sales"
      period="W"
      span={span}
      className={className}
      bodyClassName="px-0 overflow-x-hidden"
      headerControl={
        <V1Toggle<CmpMode>
          className="ms-1"
          value={mode}
          onChange={setMode}
          options={[
            { value: "previous", label: "Prev" },
            { value: "yoy", label: "YoY" },
          ]}
        />
      }
    >
      <table className={cn(V1_TBL, "[&_th]:!px-1.5 [&_th]:!py-1.5 [&_td]:!px-1.5 [&_td]:!py-1.5")}>
        <thead>
          <tr>
            <th className={cn(V1_TH, "w-28")} />
            {METRICS.map((m) => (
              <th key={m.key} className={cn(V1_TH, V1_NUM, "font-semibold text-foreground/80")}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label}>
              <td className={cn(V1_TD, "font-semibold text-foreground/70")}>{g.label}</td>
              {METRICS.map((m) => {
                const curr = g.current[m.key] ?? 0;
                const base = g.baseline[m.key] ?? 0;
                return (
                  <td key={m.key} className={cn(V1_TD, V1_NUM)}>
                    <div className="font-semibold tabular-nums leading-tight">{m.fmt(curr)}</div>
                    <div className="flex items-center justify-end gap-1 leading-tight">
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {baseLabel} {m.fmt(base)}
                      </span>
                      <div className="[&>span]:!text-[9px] [&>span]:!px-1 [&>span]:!py-0 [&>span_svg]:!h-2 [&>span_svg]:!w-2">
                        <Delta value={pctChangeOrNull(curr, base)} />
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </V1Card>
  );
}
