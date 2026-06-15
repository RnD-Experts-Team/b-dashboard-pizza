"use client";

import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TBL, TH, TD } from "@/components/wbr-reports/primitives";
import type { NonNegotiableReport } from "@/types/dashboard-report.types";

function fmtDateTime(date: string, time: string): string {
  const [, m, d] = date.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [h, min] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${h12}:${min} ${ampm}`;
}

export function WbrNonNegotiableCard({
  data,
  className,
}: {
  data?: NonNegotiableReport[];
  className?: string;
}) {
  if (!data) return null;

  return (
    <Card className={cn("flex flex-col h-[280px] py-1.5 gap-0 bg-linear-to-r from-red-50 via-red-100 to-red-200 dark:from-red-950/20 dark:via-red-900/40 dark:to-red-800/50", className)}>
      <CardHeader className="pb-1 px-3 shrink-0">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-red-500/15 dark:bg-red-500/20">
            <ShieldAlert className="h-3 w-3 text-red-500" />
          </div>
          Non-Negotiable Reports
          <Badge
            variant="secondary"
            className={cn(
              "ml-auto text-[10px] px-1.5 py-0 h-4",
              data.length > 0
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            {data.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-1 flex-1 overflow-y-auto min-h-0">
        {data.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-muted-foreground">No incidents this period.</p>
        ) : (
          <table className={cn(TBL, "[&_th]:!bg-muted/60")}>
            <thead>
              <tr>
                <th className={TH}>Action</th>
                <th className={TH}>Start</th>
                <th className={TH}>End</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-300 text-red-600 dark:text-red-400">
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap text-[12px]">
                    {fmtDateTime(r.date, r.time)}
                  </td>
                  <td className="px-2 py-1.5 align-middle whitespace-nowrap text-[12px]">
                    {fmtDateTime(r.date_two, r.time_two)}
                  </td>
                  <td
                    className="px-2 py-1.5 align-middle text-[11px] text-muted-foreground max-w-[240px] truncate"
                    title={r.notes ?? undefined}
                  >
                    {r.notes?.trim() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
