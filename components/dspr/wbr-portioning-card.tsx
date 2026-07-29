"use client";

import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Portioning } from "@/types/dashboard-report.types";
import { fmt$2, fmtPct2, fmtDate, WbrCardSkeleton } from "./wbr-format";

/** Positive variance = used more than theoretical (bad); negative = used less (good). */
function fmtVariance(n: number): string {
  return `${n > 0 ? "+" : ""}${fmt$2(n)}`;
}

export function WbrPortioningCard({
  data,
  isLoading,
  className,
}: {
  data?: Portioning;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, theo_usage, variance_breakdown } = data;

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
            <Scale className="h-3 w-3 text-teal-600" />
          </div>
          Portioning
          <span className="ml-auto font-normal text-muted-foreground">
            {fmtDate(filtering.week_start)} → {fmtDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-2.5">
        <div className="rounded-md bg-background/50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Theoretical Usage
          </p>
          <p className="text-lg font-bold tabular-nums">{fmt$2(theo_usage)}</p>
        </div>

        {variance_breakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-center">
            <Scale className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">No variance data this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {variance_breakdown.map((entry) => {
              const isOver = entry.variance_value > 0;
              const isUnder = entry.variance_value < 0;
              return (
                <div
                  key={entry.ingredient_id}
                  className="rounded-md bg-background/50 px-3 py-2.5"
                >
                  <p
                    className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    title={entry.ingredient_description}
                  >
                    {entry.ingredient_description}
                  </p>
                  <p
                    className={cn(
                      "flex items-baseline gap-1.5 text-[15px] font-bold tabular-nums",
                      isOver && "text-red-600 dark:text-red-400",
                      isUnder && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {fmtVariance(entry.variance_value)}
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {fmtPct2(entry.percentage_of_theo_usage)}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
