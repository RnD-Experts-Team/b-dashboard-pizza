"use client";

import { useMemo } from "react";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { fmt$, fmt$2, fmtDate, fmtNum, fmtNumD, perStoreDay } from "@/components/business-reports/report-format";
import type { SalesDay, SalesSection } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrSalesSummaryCard — the range's headline sales figures (V1 "Customer &
 *  Sales" for many stores): totals, per-store-day averages, best/worst day.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_SALES_SUMMARY_SPAN: V1Span = 1;

function pickDay(days: SalesDay[], better: (a: SalesDay, b: SalesDay) => boolean): SalesDay | null {
  return days.reduce<SalesDay | null>((acc, d) => (acc === null || better(d, acc) ? d : acc), null);
}

export function BrSalesSummaryCard({ data }: { data: SalesSection }) {
  const t = data.totals;

  const { best, worst } = useMemo(() => {
    const reported = data.by_date.filter((d) => d.store_days > 0);
    return {
      best: pickDay(reported, (a, b) => a.sales > b.sales),
      worst: pickDay(reported, (a, b) => a.sales < b.sales),
    };
  }, [data.by_date]);

  return (
    <V1Card
      title="Sales Summary"
      category="sales"
      period="R"
      span={BR_SALES_SUMMARY_SPAN}
      headerNote={`${fmtNum(t.store_days)} store-days`}
    >
      <div className="space-y-1.5">
        <V1MetricGrid>
          <V1Metric size="sm" label="Sales" value={fmt$(t.sales)} accent="text-emerald-600 dark:text-emerald-400" />
          <V1Metric size="sm" label="Guests" value={fmtNum(t.customer_count)} />
          <V1Metric size="sm" label="Orders" value={fmtNum(t.total_orders)} />
          <V1Metric size="sm" label="Avg ticket" value={fmt$2(t.avg_ticket)} />
        </V1MetricGrid>
        <V1SubLabel>Per store-day</V1SubLabel>
        <V1MetricGrid>
          <V1Metric size="sm" label="Sales" value={fmt$(perStoreDay(t.sales, t.store_days))} />
          <V1Metric size="sm" label="Guests" value={fmtNumD(perStoreDay(t.customer_count, t.store_days))} />
        </V1MetricGrid>
        <V1MetricGrid>
          <V1Metric
            size="sm"
            label="Best day"
            value={best ? fmt$(best.sales) : "—"}
            sub={best ? fmtDate(best.date) : undefined}
            accent="text-emerald-600 dark:text-emerald-400"
          />
          <V1Metric
            size="sm"
            label="Worst day"
            value={worst ? fmt$(worst.sales) : "—"}
            sub={worst ? fmtDate(worst.date) : undefined}
            accent="text-red-600 dark:text-red-400"
          />
        </V1MetricGrid>
      </div>
    </V1Card>
  );
}
