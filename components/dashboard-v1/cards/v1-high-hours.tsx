"use client";

import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HighHoursEmployees } from "@/types/employee.types";
import { fmt$, fmt$2, fmtNumD, WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import {
  V1Metric,
  V1Empty,
  V1_TBL,
  V1_TH,
  V1_TD,
  V1_NUM,
} from "@/components/dashboard-v1/v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1HighHoursCard — employees over 60h this week (people).
 *  Data shaping mirrors components/dspr/wbr-high-hours-card.tsx.
 * ────────────────────────────────────────────────────────────────────────── */

export function V1HighHoursCard({
  data,
  isLoading,
  span,
  className,
}: {
  data?: HighHoursEmployees | null;
  isLoading?: boolean;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  if (isLoading)
    return (
      <div className={["col-span-1 md:col-span-1 lg:col-span-2", className].filter(Boolean).join(" ")}>
        <WbrCardSkeleton />
      </div>
    );
  if (!data)
    return (
      <V1Card title="Above 60 Hours Employees" category="people" period="W" span={span} className={className}>
        <V1Empty>No data available for this period.</V1Empty>
      </V1Card>
    );

  const employees = [...data.employees].sort(
    (a, b) => b.total_hours - a.total_hours,
  );

  return (
    <V1Card
      title="Above 60 Hours Employees"
      category="people"
      period="W"
      span={span}
      className={className}
      bodyClassName="px-0"
    >
      {employees.length === 0 ? (
        <V1Empty icon={Timer}>No employees over 60h</V1Empty>
      ) : (
        <>
          <div className="px-3 pb-1.5">
            <V1Metric label="Over 60h" value={employees.length} size="sm" />
          </div>
          <table className={V1_TBL}>
            <thead>
              <tr>
                <th className={V1_TH}>Name</th>
                <th className={V1_TH}>Position</th>
                <th className={cn(V1_TH, V1_NUM)}>Hrs</th>
                <th className={cn(V1_TH, V1_NUM)}>Pay</th>
                <th className={cn(V1_TH, V1_NUM)}>Gross</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={`${e.employee_id}-${e.first_name}-${e.last_name}`}>
                  <td className={cn(V1_TD, "font-medium")}>
                    {e.first_name} {e.last_name}
                  </td>
                  <td
                    className={cn(V1_TD, "text-muted-foreground")}
                    title={e.position}
                  >
                    {e.position}
                  </td>
                  <td
                    className={cn(
                      V1_TD,
                      V1_NUM,
                      "font-semibold text-violet-600 dark:text-violet-400",
                    )}
                  >
                    {fmtNumD(e.total_hours, 1)}
                  </td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmt$2(e.hourly_pay)}</td>
                  <td className={cn(V1_TD, V1_NUM)}>{fmt$(e.gross_pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </V1Card>
  );
}
