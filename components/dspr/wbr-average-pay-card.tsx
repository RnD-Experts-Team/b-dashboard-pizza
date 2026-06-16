"use client";

import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AverageHourlyPay } from "@/types/employee.types";
import { fmt$2, fmtNumD, StatTile, WbrCardSkeleton } from "./wbr-format";

export function WbrAveragePayCard({
  data,
  isLoading,
  className,
}: {
  data?: AverageHourlyPay | null;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-indigo-50 via-indigo-100 to-indigo-200 dark:from-indigo-950/20 dark:via-indigo-900/40 dark:to-indigo-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-indigo-500/15 p-0.5 dark:bg-indigo-500/20">
            <Wallet className="h-3 w-3 text-indigo-500" />
          </div>
          Average Hourly Pay
          <span className="ml-auto font-normal text-muted-foreground">
            {data.week_start} → {data.week_end}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {/* Headline average */}
        <div className="mb-2 rounded-md bg-background/50 px-3 py-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Average Hourly Pay
          </p>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {fmt$2(data.average_hourly_pay)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <StatTile label="Maximum" value={fmt$2(data.maximum_hourly_pay)} />
          <StatTile label="Minimum" value={fmt$2(data.minimum_hourly_pay)} />
          <StatTile label="Total Tips" value={fmt$2(data.total_tips)} />
          <StatTile label="Total Hours" value={fmtNumD(data.total_hours, 1)} />
          <StatTile
            label="Tips / Hour"
            value={fmt$2(data.tips_per_hour)}
            className="col-span-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}
