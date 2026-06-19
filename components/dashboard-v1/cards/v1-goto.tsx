"use client";

import type { GoTo } from "@/types/dashboard-report.types";
import { fmtNum, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1MetricGrid,
  V1DataRow,
  V1SubLabel,
  V1Empty,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1GoToCard — weekly Go-To call volume.
 *  Data shaping mirrors components/dspr/wbr-goto-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1GoToCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: GoTo;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Go-To Calls" category="operations" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, summary } = data;
  const answered = Math.max(0, summary.total_calls - summary.missed);

  return (
    <V1Card
      title="Go-To Calls"
      category="operations"
      period="W"
      span={span}
      className={className}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={3}>
          <V1Metric label="Total Calls" value={fmtNum(summary.total_calls)} />
          <V1Metric
            label="Answered"
            value={fmtNum(answered)}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <V1Metric
            label="Missed"
            value={fmtNum(summary.missed)}
            accent={
              summary.missed > 0
                ? "text-red-600 dark:text-red-400"
                : undefined
            }
          />
        </V1MetricGrid>

        <div>
          <V1SubLabel className="mb-0.5">Source Breakdown</V1SubLabel>
          <V1DataRow label="Store" value={fmtNum(summary.is_store)} />
          <V1DataRow
            label="Store Manager"
            value={fmtNum(summary.is_store_manager)}
          />
          <V1DataRow
            label="Call Center"
            value={fmtNum(summary.is_call_center)}
          />
        </div>
      </div>
    </V1Card>
  );
}
