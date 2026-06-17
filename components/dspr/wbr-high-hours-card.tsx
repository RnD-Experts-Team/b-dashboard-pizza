"use client";

import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { HighHoursEmployees } from "@/types/employee.types";
import { fmt$2, fmtNumD, WbrCardSkeleton } from "./wbr-format";

export function WbrHighHoursCard({
  data,
  isLoading,
  className,
}: {
  data?: HighHoursEmployees | null;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const employees = [...data.employees].sort(
    (a, b) => b.total_hours - a.total_hours,
  );

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-teal-50 via-teal-100 to-teal-200 dark:from-teal-950/20 dark:via-teal-900/40 dark:to-teal-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-teal-500/15 p-0.5 dark:bg-teal-500/20">
            <Timer className="h-3 w-3 text-teal-500" />
          </div>
          Weekly Above 60 Hours Employees
          <span className="ml-auto font-normal text-muted-foreground">
            {employees.length}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-0 pb-1">
        <table className={cn(TBL, "[&_th]:!bg-muted")}>
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Position</th>
              <th className={cn(TH, NUM)}>Hrs</th>
              <th className={cn(TH, NUM)}>Pay</th>
              <th className={cn(TH, NUM)}>Gross</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={`${e.first_name}-${e.last_name}-${e.position}`}>
                <td className={cn(TD, "font-medium")}>
                  {e.first_name} {e.last_name}
                </td>
                <td className={cn(TD, "text-muted-foreground")} title={e.position}>
                  {e.position}
                </td>
                <td className={cn(TD, NUM)}>{fmtNumD(e.total_hours, 1)}</td>
                <td className={cn(TD, NUM)}>{fmt$2(e.hourly_pay)}</td>
                <td className={cn(TD, NUM)}>{fmt$2(e.gross_pay)}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className={cn(TD, "text-muted-foreground")}>
                  No high-hours employees this week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
