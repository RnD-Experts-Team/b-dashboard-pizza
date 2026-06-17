"use client";

import { useState } from "react";
import type { CustomerCountAndSales } from "@/types/dashboard-report.types";
import { fmt$, fmtNum, Delta, pctChangeOrNull, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1SubLabel, V1DataRow, V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1CustomerSalesCard — weekly customer & sales, grouped by granularity
 *  (Week / Period / Quarter / Year), each metric compared current vs a
 *  baseline (previous, or same-period-last-year via the Prev/YoY toggle).
 *  Mirrors the data shaping of wbr-customer-sales-card + wbr-comparison.
 * ────────────────────────────────────────────────────────────────────────── */

type CmpMode = "previous" | "yoy";

interface CmpGroup {
  label: string;
  current: { total_sales: number; customer_count: number };
  baseline: { total_sales: number; customer_count: number };
}

export function V1CustomerSalesCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: CustomerCountAndSales;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const [mode, setMode] = useState<CmpMode>("previous");

  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data)
    return (
      <V1Card title="Customer & Sales" category="sales" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const { filtering, week, period, quarter, year } = data;

  const groups: CmpGroup[] = [
    {
      label: "Week",
      current: week.current,
      baseline: mode === "yoy" ? week.same_week_last_year : week.previous,
    },
    {
      label: "Period",
      current: period.current,
      baseline: mode === "yoy" ? period.same_period_last_year : period.previous,
    },
    {
      label: "Quarter",
      current: quarter.current,
      baseline:
        mode === "yoy" ? quarter.same_quarter_last_year : quarter.previous,
    },
    // Year only has current vs previous — same in both modes.
    { label: "Year", current: year.current, baseline: year.previous },
  ];

  return (
    <V1Card
      title="Customer & Sales"
      category="sales"
      period="W"
      span={span}
      className={className}
      headerNote={`Wk ${filtering.week_number} · P${filtering.period_number}`}
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
      <div className="space-y-2">
        {groups.map((g) => {
          const salesDelta = pctChangeOrNull(
            g.current.total_sales,
            g.baseline.total_sales,
          );
          const guestsDelta = pctChangeOrNull(
            g.current.customer_count,
            g.baseline.customer_count,
          );
          return (
            <div key={g.label}>
              <V1SubLabel>{g.label}</V1SubLabel>
              <V1DataRow
                label="Sales"
                value={fmt$(g.current.total_sales)}
                trailing={<Delta value={salesDelta} />}
              />
              <V1DataRow
                label="Guests"
                value={fmtNum(g.current.customer_count)}
                trailing={<Delta value={guestsDelta} />}
              />
            </div>
          );
        })}
      </div>
    </V1Card>
  );
}
