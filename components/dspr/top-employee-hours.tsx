"use client";

import type { UseManagerDashboardResult } from "@/lib/hooks/use-manager-dashboard";
import type { ManagerDashboardEmployee } from "@/types/employee.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Clock, RefreshCw, Loader2, AlertCircle } from "lucide-react";

const RANK_COLORS = [
  "bg-amber-500 text-white",
  "bg-slate-400 text-white",
  "bg-amber-700 text-white",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

const BAR_COLOR = "bg-teal-500/30 dark:bg-teal-400/20";

interface TopEmployeeHoursProps {
  managerDashboard: UseManagerDashboardResult;
  className?: string;
}

function formatName(emp: ManagerDashboardEmployee): string {
  return [emp.name.first, emp.name.last].filter(Boolean).join(" ");
}

export function TopEmployeeHours({ managerDashboard, className }: TopEmployeeHoursProps) {
  const { data, isLoading, error, refetch } = managerDashboard;

  // Sort employees by metric value descending; those without a metric go last
  const ranked: ManagerDashboardEmployee[] = data
    ? [...data.employees]
        .filter((e) => e.metric !== null)
        .sort((a, b) => (b.metric!.value_numeric) - (a.metric!.value_numeric))
        .slice(0, 5)
    : [];

  const maxValue = ranked.length > 0 ? ranked[0].metric!.value_numeric : 1;

  return (
    <Card
      className={cn(
        "py-1.5 gap-0 bg-linear-to-r from-teal-50 via-teal-100 to-cyan-100 dark:from-teal-950/20 dark:via-teal-900/20 dark:to-cyan-900/20",
        className,
      )}
    >
      <CardHeader className="pb-0.5 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-teal-500/15 dark:bg-teal-500/20">
            <Clock className="h-3 w-3 text-teal-500" />
          </div>
          Top Employee Performance
          <div className="ms-auto flex items-center gap-1">
            <span className="text-[8px] font-normal text-muted-foreground">This week</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={refetch}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <RefreshCw className="h-2.5 w-2.5" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-1 pt-1 space-y-0">
        {isLoading && !data ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5 px-1 py-1">
                <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-8 shrink-0" />
              </div>
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
            <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground text-center">{error}</p>
            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={refetch}>
              <RefreshCw className="h-3 w-3 me-1" />
              Retry
            </Button>
          </div>
        ) : ranked.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 gap-1">
            <Clock className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No metric data available</p>
          </div>
        ) : (
          ranked.map((emp, idx) => {
            const barWidth = (emp.metric!.value_numeric / maxValue) * 100;
            return (
              <div
                key={emp.employee_id}
                className="group/item relative rounded px-1 py-1 mb-0.5 hover:bg-muted/50 transition-colors"
              >
                {/* Background bar */}
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-md transition-all", BAR_COLOR)}
                  style={{ width: `${barWidth}%` }}
                />
                <div className="relative flex items-center gap-1.5">
                  {/* Rank badge */}
                  <span
                    className={cn(
                      "text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0",
                      RANK_COLORS[idx] ?? RANK_COLORS[3],
                    )}
                  >
                    {idx + 1}
                  </span>
                  {/* Name + position */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{formatName(emp)}</p>
                  </div>
                  {/* Metric value */}
                  <span className="text-[11px] font-bold tabular-nums text-teal-700 dark:text-teal-300 shrink-0">
                    {emp.metric!.value_numeric.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
