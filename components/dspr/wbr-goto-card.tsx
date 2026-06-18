"use client";

import { cn } from "@/lib/utils";
import { PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoTo } from "@/types/dashboard-report.types";
import { fmtDate, fmtNum, StatTile, WbrCardSkeleton } from "./wbr-format";

export function WbrGoToCard({
  data,
  isLoading,
  className,
}: {
  data?: GoTo;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  const { filtering, summary } = data;
  const answered = Math.max(0, summary.total_calls - summary.missed);

  return (
    <Card
      className={cn(
        "flex h-[280px] flex-col gap-0 py-1.5 bg-linear-to-r from-cyan-50 via-cyan-100 to-cyan-200 dark:from-cyan-950/20 dark:via-cyan-900/40 dark:to-cyan-800/50",
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
          <div className="rounded bg-cyan-500/15 p-0.5 dark:bg-cyan-500/20">
            <PhoneCall className="h-3 w-3 text-cyan-500" />
          </div>
          Weekly Go-To Calls
          <span className="ml-auto font-normal text-muted-foreground">
            {fmtDate(filtering.week_start)} → {fmtDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          <StatTile label="Total Calls" value={fmtNum(summary.total_calls)} />
          <StatTile
            label="Missed"
            value={fmtNum(summary.missed)}
            valueClass={
              summary.missed > 0 ? "text-red-600 dark:text-red-400" : undefined
            }
          />
          <StatTile
            label="Answered"
            value={fmtNum(answered)}
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <StatTile label="Store" value={fmtNum(summary.is_store)} />
          <StatTile
            label="Store Manager"
            value={fmtNum(summary.is_store_manager)}
          />
          <StatTile
            label="Call Center"
            value={fmtNum(summary.is_call_center)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
