"use client";

import { Kpi } from "@/components/wbr-reports/primitives";
import { fmt$, fmt$2, fmtNum, fmtPct } from "@/lib/mock/business-reports.mock";
import type { MultiDashboardResponse } from "@/types/business-reports.types";

/**
 * Aggregate KPI strip driven by the multi-dashboard `totals` rollup.
 * Rendered above the tabs so the headline numbers are always visible.
 */
export function KpiSummary({ data }: { data: MultiDashboardResponse | null }) {
  if (!data || !data.totals) return null;
  const t = data.totals;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi label="Gross Sales" value={fmt$(t.gross_sales)} />
      <Kpi label="Net Sales" value={fmt$(t.net_sales)} />
      <Kpi label="Royalty" value={fmt$(t.royalty_obligation)} />
      <Kpi label="Total Orders" value={fmtNum(t.total_orders)} />
      <Kpi label="Customers" value={fmtNum(t.customer_count)} />
      <Kpi label="Avg Order Value" value={fmt$2(t.avg_order_value)} />
      <Kpi label="Portal Usage" value={fmtPct(t.portal_usage_rate)} />
      <Kpi label="Portal On-Time" value={fmtPct(t.portal_on_time_rate)} />
      <Kpi label="Digital Penetration" value={fmtPct(t.digital_penetration)} />
      <Kpi label="Delivery Rate" value={fmtPct(t.delivery_rate)} />
      <Kpi label="Total Tips" value={fmt$(t.total_tips)} />
      <Kpi label="Cash Sales" value={fmt$(t.cash_sales)} />
    </div>
  );
}
