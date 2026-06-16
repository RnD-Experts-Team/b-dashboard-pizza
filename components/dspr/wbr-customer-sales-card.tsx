"use client";

import { Users } from "lucide-react";
import type { CustomerCountAndSales } from "@/types/dashboard-report.types";
import { fmt$, fmtNum } from "./wbr-format";
import {
  PeriodComparisonCard,
  type CmpGroup,
  type CmpMode,
} from "./wbr-comparison";

const METRICS = [
  { key: "total_sales", label: "Sales", format: fmt$ },
  { key: "customer_count", label: "Guests", format: fmtNum },
];

export function WbrCustomerSalesCard({
  data,
  className,
}: {
  data?: CustomerCountAndSales;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, week, period, quarter, year } = data;

  const groupsForMode = (mode: CmpMode): CmpGroup[] => [
    {
      label: "Week",
      current: { ...week.current },
      baseline: { ...(mode === "yoy" ? week.same_week_last_year : week.previous) },
    },
    {
      label: "Period",
      current: { ...period.current },
      baseline: {
        ...(mode === "yoy" ? period.same_period_last_year : period.previous),
      },
    },
    {
      label: "Quarter",
      current: { ...quarter.current },
      baseline: {
        ...(mode === "yoy" ? quarter.same_quarter_last_year : quarter.previous),
      },
    },
    // Year only has current vs previous — same in both modes.
    { label: "Year", current: { ...year.current }, baseline: { ...year.previous } },
  ];

  return (
    <PeriodComparisonCard
      title="Customer & Sales"
      icon={Users}
      iconColor="text-blue-500"
      iconBg="bg-blue-500/15 dark:bg-blue-500/20"
      gradient="from-blue-50 via-blue-100 to-blue-200 dark:from-blue-950/20 dark:via-blue-900/40 dark:to-blue-800/50"
      headerNote={`Wk ${filtering.week_number} · P${filtering.period_number}`}
      metrics={METRICS}
      groupsForMode={groupsForMode}
      className={className}
    />
  );
}
