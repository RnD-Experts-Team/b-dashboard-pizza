"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TBL, TH, TD, NUM } from "@/components/wbr-reports/primitives";
import type {
  PortalWeekly,
  PortalWeeklyRow,
} from "@/types/dashboard-report.types";
import { fmtPct, WbrCardSkeleton } from "./wbr-format";
import { WbrDetailDialog } from "./wbr-detail-dialog";

function shortRange(r: PortalWeeklyRow): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmt = (d: string) => {
    const [, m, day] = d.split("-");
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
  };
  return `${fmt(r.week_start)} – ${fmt(r.week_end)}`;
}

/** Point change (curr − prev) rendered as "+1.5pp" with sign colouring. */
function PpDelta({ curr, prev }: { curr: number; prev?: number }) {
  if (prev === undefined) return <span className="text-muted-foreground">—</span>;
  const d = curr - prev;
  if (Math.abs(d) < 0.05) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "tabular-nums",
        d > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      {d > 0 ? "+" : ""}
      {d.toFixed(1)}pp
    </span>
  );
}

export function WbrPortalWeeklyCard({
  data,
  isLoading,
  className,
}: {
  data?: PortalWeekly;
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (isLoading) return <WbrCardSkeleton className={className} />;
  if (!data) return null;

  // Latest week first.
  const weeks = [...data.weeks].sort((a, b) =>
    b.week_start.localeCompare(a.week_start),
  );
  const currentWeekStart = data.filtering.week_start;

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-[280px] cursor-pointer flex-col gap-0 py-1.5 transition-shadow hover:shadow-md bg-linear-to-r from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50",
          className,
        )}
      >
        <CardHeader className="shrink-0 px-3 pb-1">
          <CardTitle className="flex items-center gap-1 text-[11px] font-semibold">
            <div className="rounded bg-emerald-500/15 p-0.5 dark:bg-emerald-500/20">
              <Clock className="h-3 w-3 text-emerald-500" />
            </div>
            Portal &amp; HNR Weekly
            <span className="ml-auto font-normal text-muted-foreground">
              {weeks.length} wks
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-0 pb-1">
          <table className={cn(TBL, "[&_th]:!bg-muted")}>
            <thead>
              <tr>
                <th className={TH}>Week</th>
                <th className={cn(TH, NUM)}>Portal %</th>
                <th className={cn(TH, NUM)}>HNR %</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => {
                const prev = weeks[i + 1];
                const isCurrent = w.week_start === currentWeekStart;
                return (
                  <tr key={w.week_start} className={cn(isCurrent && "font-semibold")}>
                    <td className={TD}>{shortRange(w)}</td>
                    <td className={cn(TD, NUM)}>
                      {fmtPct(w.in_portal_on_time_percent)}{" "}
                      <span className="text-[10px]">
                        <PpDelta
                          curr={w.in_portal_on_time_percent}
                          prev={prev?.in_portal_on_time_percent}
                        />
                      </span>
                    </td>
                    <td className={cn(TD, NUM)}>
                      {fmtPct(w.hnr_promise_met_percent)}{" "}
                      <span className="text-[10px]">
                        <PpDelta
                          curr={w.hnr_promise_met_percent}
                          prev={prev?.hnr_promise_met_percent}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Portal & HNR — Weekly History"
        badgeText={`${weeks.length} weeks`}
      >
        <table className={cn(TBL, "[&_th]:!bg-muted/60")}>
          <thead>
            <tr>
              <th className={TH}>Week</th>
              <th className={cn(TH, NUM)}>Eligible</th>
              <th className={cn(TH, NUM)}>Used</th>
              <th className={cn(TH, NUM)}>On-Time</th>
              <th className={cn(TH, NUM)}>Portal %</th>
              <th className={cn(TH, NUM)}>Δ</th>
              <th className={cn(TH, NUM)}>HNR Txns</th>
              <th className={cn(TH, NUM)}>Broken</th>
              <th className={cn(TH, NUM)}>Met</th>
              <th className={cn(TH, NUM)}>HNR %</th>
              <th className={cn(TH, NUM)}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => {
              const prev = weeks[i + 1];
              const isCurrent = w.week_start === currentWeekStart;
              return (
                <tr key={w.week_start} className={cn(isCurrent && "font-semibold")}>
                  <td className={cn(TD, "whitespace-nowrap")}>{shortRange(w)}</td>
                  <td className={cn(TD, NUM)}>{w.portal_eligible_orders}</td>
                  <td className={cn(TD, NUM)}>{w.portal_used_orders}</td>
                  <td className={cn(TD, NUM)}>{w.portal_on_time_orders}</td>
                  <td className={cn(TD, NUM)}>{fmtPct(w.in_portal_on_time_percent)}</td>
                  <td className={cn(TD, NUM)}>
                    <PpDelta
                      curr={w.in_portal_on_time_percent}
                      prev={prev?.in_portal_on_time_percent}
                    />
                  </td>
                  <td className={cn(TD, NUM)}>{w.hnr_transactions}</td>
                  <td className={cn(TD, NUM)}>{w.hnr_broken_promises}</td>
                  <td className={cn(TD, NUM)}>{w.hnr_promise_met}</td>
                  <td className={cn(TD, NUM)}>{fmtPct(w.hnr_promise_met_percent)}</td>
                  <td className={cn(TD, NUM)}>
                    <PpDelta
                      curr={w.hnr_promise_met_percent}
                      prev={prev?.hnr_promise_met_percent}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Δ compares each week to the prior week. Portal % = in-portal on-time;
          HNR % = promise met.
        </p>
      </WbrDetailDialog>
    </>
  );
}
