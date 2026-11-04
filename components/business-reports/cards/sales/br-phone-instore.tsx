"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty, V1_TBL, V1_TH, V1_TD, V1_NUM } from "@/components/dashboard-v1/v1-ui";
import { Delta, fmt$, fmtPct, pctChangeOrNull, share, weekLabel } from "@/components/business-reports/report-format";
import type { SalesSection, SalesWeek } from "@/types/business-reports.types";
import { compareText } from "../../report-format";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPhoneInStoreCard — V1 "Phone & In-Store" over the range: Phone and In
 *  Store (register) totals with their share of sales, then every week inside
 *  the range (latest first) with week-over-week change.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PHONE_INSTORE_SPAN: V1Span = 1;

const METRICS = [
  { key: "phone_sales", label: "Phone" },
  { key: "register_sales", label: "In Store" },
] as const;

interface WeekRow {
  week: SalesWeek;
  prev: SalesWeek | null;
}

const SMALL_DELTA = "[&>span]:!px-1 [&>span]:!py-0 [&>span]:!text-[9px] [&>span_svg]:!h-2 [&>span_svg]:!w-2";

export function BrPhoneInStoreCard({ data }: { data: SalesSection }) {
  const t = data.totals;

  const rows = useMemo<WeekRow[]>(() => {
    const asc = [...data.by_week].sort((a, b) => compareText(a.week_start, b.week_start));
    return asc.map((week, i) => ({ week, prev: i > 0 ? asc[i - 1] : null })).reverse();
  }, [data.by_week]);

  return (
    <V1Card
      title="Phone & In-Store"
      category="sales"
      period="R"
      span={BR_PHONE_INSTORE_SPAN}
      bodyClassName="px-0 overflow-x-hidden"
    >
      <div className="space-y-1.5">
        <V1MetricGrid className="px-3">
          {METRICS.map((m) => (
            <V1Metric
              key={m.key}
              size="sm"
              label={m.label}
              value={fmt$(t[m.key])}
              sub={`${fmtPct(share(t[m.key], t.sales))} of sales`}
            />
          ))}
        </V1MetricGrid>

        {rows.length === 0 ? (
          <V1Empty>No weeks in this range.</V1Empty>
        ) : (
          <table className={cn(V1_TBL, "[&_td]:!px-1.5 [&_th]:!px-1.5")}>
            <thead>
              <tr>
                <th className={V1_TH}>Week</th>
                {METRICS.map((m) => (
                  <th key={m.key} className={cn(V1_TH, V1_NUM)}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ week, prev }) => (
                <tr key={week.week_start}>
                  <td className={cn(V1_TD, "font-semibold text-foreground/70")}>{weekLabel(week)}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className={cn(V1_TD, V1_NUM)}>
                      <div className="font-semibold leading-tight tabular-nums">{fmt$(week[m.key])}</div>
                      <div className={cn("flex justify-end leading-tight", SMALL_DELTA)}>
                        <Delta value={prev ? pctChangeOrNull(week[m.key], prev[m.key]) : null} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </V1Card>
  );
}
