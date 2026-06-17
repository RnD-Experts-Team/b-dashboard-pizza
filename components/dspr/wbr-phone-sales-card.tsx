"use client";

import { Phone } from "lucide-react";
import type { PhoneAndAdjustedSales } from "@/types/dashboard-report.types";
import { fmt$, WbrCardSkeleton } from "./wbr-format";
import {
  PeriodComparisonCard,
  type CmpGroup,
  type CmpMode,
} from "./wbr-comparison";

const METRICS = [
  { key: "phone_sales", label: "Phone", format: fmt$ },
  // adjusted_royalty_obligation is presented to the user as "In Store".
  { key: "adjusted_royalty_obligation", label: "In Store", format: fmt$ },
];

export function WbrPhoneSalesCard({
  data,
  isLoading,
  className,
}: {
  data?: PhoneAndAdjustedSales;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, week, period, quarter, year } = data;

  const groupsForMode = (mode: CmpMode): CmpGroup[] => [
    {
      label: "Week",
      current: { ...week.current },
      baseline: {
        ...(mode === "yoy" ? week.same_week_last_year ?? {} : week.previous),
      },
    },
    {
      label: "Period",
      current: { ...period.current },
      baseline: {
        ...(mode === "yoy"
          ? period.same_period_last_year ?? {}
          : period.previous),
      },
    },
    {
      label: "Quarter",
      current: { ...quarter.current },
      baseline: {
        ...(mode === "yoy"
          ? quarter.same_quarter_last_year ?? {}
          : quarter.previous),
      },
    },
    { label: "Year", current: { ...year.current }, baseline: { ...year.previous } },
  ];

  return (
    <PeriodComparisonCard
      title="Weekly Phone & In-Store"
      icon={Phone}
      iconColor="text-sky-500"
      iconBg="bg-sky-500/15 dark:bg-sky-500/20"
      gradient="from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50"
      headerNote={`Wk ${filtering.week_number} · P${filtering.period_number}`}
      metrics={METRICS}
      groupsForMode={groupsForMode}
      className={className}
    />
  );
}
