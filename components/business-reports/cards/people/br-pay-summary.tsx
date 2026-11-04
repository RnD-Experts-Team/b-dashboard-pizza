"use client";

import { useMemo } from "react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import { fmtCurrency, fmtHours, fmtPercent } from "@/components/labor/labor-format";
import { laborColor } from "@/components/business-reports/report-format";
import type { LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Pay Summary — V1's "Average Hourly Pay" card over the range: hourly pay
 *  spread, tips, hours, and Final Labor averaged over the weeks that have it.
 * ────────────────────────────────────────────────────────────────────────── */

export function BrPaySummary({ data }: { data: LaborReport }) {
  const pay = data.combined.pay;

  const finalLabor = useMemo(() => {
    const values = data.combined.final_labor
      .map((w) => w.labor)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;
  }, [data.combined.final_labor]);

  return (
    <V1Card reportId="br-pay-summary" title="Pay Summary" category="people" period="R" span={1} height={ROW_CARD_HEIGHT}>
      <div className="space-y-1.5">
        <V1Metric label="Average Hourly Pay" value={fmtCurrency(pay.average_hourly_pay)} size="lg" />
        <V1MetricGrid cols={2}>
          <V1Metric label="Maximum" value={fmtCurrency(pay.maximum_hourly_pay)} size="sm" />
          <V1Metric label="Minimum" value={fmtCurrency(pay.minimum_hourly_pay)} size="sm" />
          <V1Metric label="Total Tips" value={fmtCurrency(pay.total_tips)} size="sm" />
          <V1Metric label="Total Hours" value={fmtHours(pay.total_hours)} size="sm" />
          <V1Metric label="Tips / Hour" value={fmtCurrency(pay.tips_per_hour)} size="sm" />
          <V1Metric
            label="Final Labor"
            value={<span style={finalLabor === null ? undefined : { color: laborColor(finalLabor) }}>{fmtPercent(finalLabor)}</span>}
            sub={finalLabor === null ? undefined : "avg of weeks"}
            size="sm"
          />
        </V1MetricGrid>
      </div>
    </V1Card>
  );
}
