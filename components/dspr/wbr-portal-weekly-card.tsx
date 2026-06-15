"use client";

import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type { PortalWeekly } from "@/types/dashboard-report.types";

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function shortDate(d: string): string {
  // "2026-06-02" → "Jun 2"
  const [, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
}

export function WbrPortalWeeklyCard({
  data,
  className,
}: {
  data?: PortalWeekly;
  className?: string;
}) {
  if (!data) return null;

  const { filtering, weeks } = data;
  const currentWeekStart = filtering.week_start;

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          Portal &amp; HNR Weekly
          <span className="font-normal text-muted-foreground ml-auto">
            {shortDate(filtering.week_start)} → {shortDate(filtering.week_end)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        <table className={TBL}>
          <thead>
            <tr>
              <th className={TH}>Week</th>
              <th className={cn(TH, NUM)}>Portal %</th>
              <th className={cn(TH, NUM)}>HNR %</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const isCurrent = w.week_start === currentWeekStart;
              return (
                <tr key={w.week_start} className={cn(isCurrent && "font-semibold")}>
                  <td className={TD}>
                    {shortDate(w.week_start)} – {shortDate(w.week_end)}
                  </td>
                  <td className={cn(TD, NUM)}>{fmtPct(w.in_portal_on_time_percent)}</td>
                  <td className={cn(TD, NUM)}>{fmtPct(w.hnr_promise_met_percent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
