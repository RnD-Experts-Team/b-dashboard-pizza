"use client";

import type { AverageHourlyPay } from "@/types/employee.types";
import { fmt$2, fmtNumD, fmtPct, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1AveragePayCard — weekly average hourly pay summary (people).
 *  Data shaping mirrors components/dspr/wbr-average-pay-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1AveragePayCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: AverageHourlyPay | null;
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
      <V1Card title="Average Hourly Pay" category="people" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  return (
    <V1Card
      title="Average Hourly Pay"
      category="people"
      period="W"
      span={span}
      className={className}
    >
      <div className="space-y-1.5">
        <V1Metric
          label="Average Hourly Pay"
          value={fmt$2(data.average_hourly_pay)}
          size="lg"
        />
        <V1MetricGrid cols={2}>
          <V1Metric label="Maximum" value={fmt$2(data.maximum_hourly_pay)} size="sm" />
          <V1Metric label="Minimum" value={fmt$2(data.minimum_hourly_pay)} size="sm" />
          <V1Metric label="Total Tips" value={fmt$2(data.total_tips)} size="sm" />
          <V1Metric label="Total Hours" value={fmtNumD(data.total_hours, 1)} size="sm" />
          <V1Metric label="Tips / Hour" value={fmt$2(data.tips_per_hour)} size="sm" />
          <V1Metric label="Labor" value={fmtPct(data.labor)} size="sm" />
        </V1MetricGrid>
      </div>
    </V1Card>
  );
}
