"use client";

import { Kpi } from "@/components/wbr-reports/primitives";
import { fmt$, fmt$2, fmtNum, fmtPct } from "@/lib/mock/business-reports.mock";
import type { MultiDashboardResponse } from "@/types/business-reports.types";
import { CATEGORIES } from "@/components/dashboard-v1/category";

/**
 * Aggregate KPI strip driven by the multi-dashboard `totals` rollup.
 * Rendered above the tabs so the headline numbers are always visible.
 */
export function KpiSummary({ data }: { data: MultiDashboardResponse | null }) {
  if (!data || !data.totals) return null;
  const t = data.totals;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi size="sm" label="Gross Sales" value={fmt$(t.gross_sales)} accent={CATEGORIES.sales} />
      <Kpi size="sm" label="Net Sales" value={fmt$(t.net_sales)} accent={CATEGORIES.sales} />
      <Kpi size="sm" label="Total Orders" value={fmtNum(t.total_orders)} accent={CATEGORIES.sales} />
      <Kpi size="sm" label="Customers" value={fmtNum(t.customer_count)} accent={CATEGORIES.sales} />
      <Kpi size="sm" label="Avg Order Value" value={fmt$2(t.avg_order_value)} accent={CATEGORIES.sales} />
      <Kpi size="sm" label="Portal Usage" value={fmtPct(t.portal_usage_rate)} accent={CATEGORIES.operations} />
      <Kpi size="sm" label="Portal On-Time" value={fmtPct(t.portal_on_time_rate)} accent={CATEGORIES.operations} />
      <Kpi size="sm" label="Digital Penetration" value={fmtPct(t.digital_penetration)} accent={CATEGORIES.operations} />
      <Kpi size="sm" label="Delivery Rate" value={fmtPct(t.delivery_rate)} accent={CATEGORIES.operations} />
      <Kpi size="sm" label="Royalty" value={fmt$(t.royalty_obligation)} accent={CATEGORIES.finance} />
      <Kpi size="sm" label="Total Tips" value={fmt$(t.total_tips)} accent={CATEGORIES.finance} />
      <Kpi size="sm" label="Cash Sales" value={fmt$(t.cash_sales)} accent={CATEGORIES.finance} />
    </div>
  );
}
