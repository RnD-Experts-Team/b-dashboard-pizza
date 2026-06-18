"use client";

import { addDays, parseISO, format } from "date-fns";
import { Users } from "lucide-react";
import type { CustomerCountAndSales } from "@/types/dashboard-report.types";
import { fmt$, fmtDate, fmtNum, WbrCardSkeleton } from "./wbr-format";
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
  isLoading,
  className,
}: {
  data?: CustomerCountAndSales;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, week, period, quarter, year } = data;
  const quarterNum = Math.ceil(filtering.period_number / 3);
  const fyShort = String(filtering.fiscal_year).slice(-2);
  const weekEnd = format(addDays(parseISO(filtering.week_start), 6), "MMM d");

  const groupsForMode = (mode: CmpMode): CmpGroup[] => [
    {
      label: `Week ${filtering.week_number}`,
      current: { ...week.current },
      baseline: { ...(mode === "yoy" ? week.same_week_last_year : week.previous) },
    },
    {
      label: `Period ${filtering.period_number}`,
      current: { ...period.current },
      baseline: {
        ...(mode === "yoy" ? period.same_period_last_year : period.previous),
      },
    },
    {
      label: `Quarter ${quarterNum}`,
      current: { ...quarter.current },
      baseline: {
        ...(mode === "yoy" ? quarter.same_quarter_last_year : quarter.previous),
      },
    },
    { label: `FY 20${fyShort}`, current: { ...year.current }, baseline: { ...year.previous } },
  ];

  return (
    <PeriodComparisonCard
      title="Weekly Customer & Sales"
      icon={Users}
      iconColor="text-blue-500"
      iconBg="bg-blue-500/15 dark:bg-blue-500/20"
      gradient="from-blue-50 via-blue-100 to-blue-200 dark:from-blue-950/20 dark:via-blue-900/40 dark:to-blue-800/50"
      headerNote={`${fmtDate(filtering.week_start)} → ${weekEnd}`}
      metrics={METRICS}
      groupsForMode={groupsForMode}
      className={className}
    />
  );
}
