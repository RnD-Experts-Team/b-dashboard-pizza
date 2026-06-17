"use client";

import { useState } from "react";
import type { PhoneAndAdjustedSales } from "@/types/dashboard-report.types";
import { fmt$, Delta, pctChangeOrNull, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1SubLabel, V1DataRow, V1Toggle, V1Empty } from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1PhoneSalesCard — weekly phone & in-store sales, grouped by granularity,
 *  each metric compared current vs baseline (Prev / YoY toggle).
 *  Metrics: phone_sales ("Phone") + adjusted_royalty_obligation ("In Store").
 *  Mirrors wbr-phone-sales-card + wbr-comparison.
 * ────────────────────────────────────────────────────────────────────────── */

type CmpMode = "previous" | "yoy";

interface PhoneVals {
  phone_sales: number;
  adjusted_royalty_obligation: number;
}

interface CmpGroup {
  label: string;
  current: PhoneVals;
  baseline: PhoneVals;
}

const EMPTY: PhoneVals = { phone_sales: 0, adjusted_royalty_obligation: 0 };

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

  const groups: CmpGroup[] = [
    {
      label: "Week",
      current: week.current,
      baseline: mode === "yoy" ? week.same_week_last_year ?? EMPTY : week.previous,
    },
    {
      label: "Period",
      current: period.current,
      baseline:
        mode === "yoy" ? period.same_period_last_year ?? EMPTY : period.previous,
    },
    {
      label: "Quarter",
      current: quarter.current,
      baseline:
        mode === "yoy"
          ? quarter.same_quarter_last_year ?? EMPTY
          : quarter.previous,
    },
    { label: "Year", current: year.current, baseline: year.previous },
  ];

  return (
    <V1Card
      title="Phone & In-Store"
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
          const phoneDelta = pctChangeOrNull(
            g.current.phone_sales,
            g.baseline.phone_sales,
          );
          const inStoreDelta = pctChangeOrNull(
            g.current.adjusted_royalty_obligation,
            g.baseline.adjusted_royalty_obligation,
          );
          return (
            <div key={g.label}>
              <V1SubLabel>{g.label}</V1SubLabel>
              <V1DataRow
                label="Phone"
                value={fmt$(g.current.phone_sales)}
                trailing={<Delta value={phoneDelta} />}
              />
              <V1DataRow
                label="In Store"
                value={fmt$(g.current.adjusted_royalty_obligation)}
                trailing={<Delta value={inStoreDelta} />}
              />
            </div>
          );
        })}
      </div>
    </V1Card>
  );
}
