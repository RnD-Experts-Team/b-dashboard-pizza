"use client";

import { cn } from "@/lib/utils";
import type { OrdersVsSales } from "@/types/dashboard-report.types";
import { fmt$, fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1OrdersVsSalesCard — weekly sales, blue-line and Pepsi totals, plus a
 *  table of blue-line % and Pepsi % across Current Wk / 4 Wks / 12 Wks / 6 Mo.
 *  Mirrors wbr-orders-vs-sales-card shaping.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1OrdersVsSalesCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: OrdersVsSales;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Orders vs Sales" category="sales" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, current_week, four_weeks, twelve_weeks, six_months } =
    data;

  const rows = [
    { label: "Current Wk", period: current_week },
    { label: "4 Weeks", period: four_weeks },
    { label: "12 Weeks", period: twelve_weeks },
    { label: "6 Months", period: six_months },
  ];

  return (
    <V1Card
      title="Orders vs Sales"
      category="sales"
      period="W"
      span={span}
      className={className}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={3}>
          <V1Metric label="Sales Wk" value={fmt$(current_week.sales)} size="sm" />
          <V1Metric
            label="Blue Line Wk"
            value={fmt$(current_week.blue_line_total)}
            accent="text-emerald-600 dark:text-emerald-400"
            size="sm"
          />
          <V1Metric
            label="Pepsi Wk"
            value={
              current_week.pepsi_total > 0
                ? fmt$(current_week.pepsi_total)
                : "—"
            }
            size="sm"
          />
        </V1MetricGrid>

        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Period</th>
              <th className={cn(V1_TH, V1_NUM)}>Blue Line %</th>
              <th className={cn(V1_TH, V1_NUM)}>Pepsi %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={V1_TD}>{r.label}</td>
                <td
                  className={cn(
                    V1_TD,
                    V1_NUM,
                    "font-medium text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {fmtPct(r.period.blue_line_pct)}
                </td>
                <td className={cn(V1_TD, V1_NUM)}>
                  {r.period.pepsi_pct > 0 ? fmtPct(r.period.pepsi_pct) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </V1Card>
  );
}
