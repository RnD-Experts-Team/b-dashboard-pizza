"use client";

import { cn } from "@/lib/utils";
import type { CashControl } from "@/types/dashboard-report.types";
import { fmt$2, fmtNum, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1SubLabel,
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1CashControlCard — weekly cash/deposit plus Deposit − Cash across
 *  Week / Period / Quarter / Year (diff colored by sign), and the week's
 *  modified / refunded / voided order counts. Mirrors wbr-cash-control-card.
 * ────────────────────────────────────────────────────────────────────────── */

function diffColor(n: number) {
  if (n > 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (n < -0.5) return "text-red-600 dark:text-red-400";
  return "";
}

export function V1CashControlCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: CashControl;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Cash Control" category="finance" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, week, period, quarter, year } = data;

  const diffRows = [
    { label: "Week", v: week.deposit_minus_cash_sales },
    { label: "Period", v: period.deposit_minus_cash_sales },
    { label: "Quarter", v: quarter.deposit_minus_cash_sales },
    { label: "Year", v: year.deposit_minus_cash_sales },
  ];

  return (
    <V1Card
      title="Cash Control"
      category="finance"
      period="W"
      span={span}
      className={className}
      headerNote={`${filtering.week_start} · P${filtering.period_number}`}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={2}>
          <V1Metric label="Cash Sales Wk" value={fmt$2(week.cash_sales)} size="sm" />
          <V1Metric label="Deposit Wk" value={fmt$2(week.deposit)} size="sm" />
        </V1MetricGrid>

        <table className={V1_TBL}>
          <thead>
            <tr>
              <th className={V1_TH}>Period</th>
              <th className={cn(V1_TH, V1_NUM)}>Deposit − Cash</th>
            </tr>
          </thead>
          <tbody>
            {diffRows.map((r) => (
              <tr key={r.label}>
                <td className={V1_TD}>{r.label}</td>
                <td className={cn(V1_TD, V1_NUM, diffColor(r.v))}>
                  {fmt$2(r.v)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <V1SubLabel className="mb-1">Order Controls (Wk)</V1SubLabel>
          <V1MetricGrid cols={3}>
            <V1Metric
              label="Modified"
              value={fmtNum(week.modified_orders ?? 0)}
              size="sm"
            />
            <V1Metric
              label="Refunded"
              value={fmtNum(week.refunded_orders ?? 0)}
              size="sm"
            />
            <V1Metric
              label="Voided"
              value={fmtNum(week.voided_orders ?? 0)}
              size="sm"
            />
          </V1MetricGrid>
        </div>
      </div>
    </V1Card>
  );
}
