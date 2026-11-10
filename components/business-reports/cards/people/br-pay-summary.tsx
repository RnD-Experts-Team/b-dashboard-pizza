"use client";

import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Metric, V1MetricGrid } from "@/components/dashboard-v1/v1-ui";
import { fmtCurrency, fmtHours } from "@/components/labor/labor-format";
import { laborValue, useFinalLabor } from "@/components/business-reports/final-labor";
import { fmt$Compact } from "@/components/business-reports/report-format";
import type { LaborReport } from "@/types/business-reports.types";
import { LaborPctValue, TALL_ROW_HEIGHT } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Pay Summary — V1's "Average Hourly Pay" card over the range: hourly pay
 *  spread, tips, hours, and the final labor % — total payroll ÷ royalty
 *  obligation over the range's store-weeks with payroll ("—" with none).
 * ────────────────────────────────────────────────────────────────────────── */

export function BrPaySummary({ data }: { data: LaborReport }) {
  const pay = data.combined.pay;
  const final = useFinalLabor();
  const { value: labor, isFinal } = laborValue(final?.overall);

  return (
    <V1Card reportId="br-pay-summary" title="Pay Summary" category="people" period="R" span={1} height={TALL_ROW_HEIGHT}>
      <div className="space-y-1.5">
        <V1Metric label="Average Hourly Pay" value={fmtCurrency(pay.average_hourly_pay)} size="lg" />
        <V1Metric
          label="Final Labor"
          value={<LaborPctValue value={labor} isFinal={isFinal} />}
          sub="payroll ÷ royalty obligation"
          size="lg"
        />
        <V1MetricGrid cols={2}>
          <V1Metric label="Maximum" value={fmtCurrency(pay.maximum_hourly_pay)} size="sm" />
          <V1Metric label="Minimum" value={fmtCurrency(pay.minimum_hourly_pay)} size="sm" />
          <V1Metric
            label="Total Tips"
            value={<span title={fmtCurrency(pay.total_tips)}>{pay.total_tips === null ? fmtCurrency(null) : fmt$Compact(pay.total_tips)}</span>}
            size="sm"
          />
          <V1Metric label="Total Hours" value={fmtHours(pay.total_hours, 0)} size="sm" />
          <V1Metric label="Tips / Hour" value={fmtCurrency(pay.tips_per_hour)} size="sm" />
          <V1Metric label="Active Employees" value={data.combined.headcount.active_end.toLocaleString()} sub="active at end" size="sm" />
        </V1MetricGrid>
      </div>
    </V1Card>
  );
}
