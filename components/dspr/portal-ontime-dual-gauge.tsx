"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, ShieldCheck, Clock, CalendarDays } from "lucide-react";
import { SpeedometerGauge } from "./speedometer-gauge";
import type { DsprPortal } from "@/types/dspr.types";
import { cn } from "@/lib/utils";
import { PERFORMANCE_ZONES, getPerformanceLabel, getPerformanceColor } from "./portal-meter-utils";
import { WtdComparisonDialog, ComparisonGrid, ComparisonTable } from "./wtd-comparison-dialog";

interface Props {
  portal: DsprPortal;
  className?: string;
}

export function PortalOnTimeDualGauge({ portal, className }: Props) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const weeklyPortal = portal.week_to_date;
  const activePortal = isWeekly && weeklyPortal ? weeklyPortal : portal;
  const primary = activePortal.put_into_portal_percent;
  const secondary = activePortal.in_portal_on_time_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50", weeklyPortal && "cursor-pointer dspr-card-hover", className)} onClick={() => weeklyPortal && setDialogOpen(true)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-emerald-500/15 dark:bg-emerald-500/20">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
          </div>
          {isWeekly ? "Portal (WTD)" : "Portal Performance"}
          {weeklyPortal ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-5 w-5 ms-auto rounded", isWeekly ? "bg-primary/15 text-primary" : "text-muted-foreground/40")}
                  onClick={(e) => { e.stopPropagation(); setIsWeekly((v) => !v); }}
                >
                  <CalendarDays className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isWeekly ? "Switch to Daily" : "Switch to Week-to-Date"}</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground ms-auto cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-50">
                Portal Usage (Red) and on-time (Green)
              </TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={primary}
          secondaryValue={secondary}
          secondaryColor="#22C55E"
          secondaryLabel=""
          zones={PERFORMANCE_ZONES}
          statusLabel={getPerformanceLabel(primary)}
          statusColor="#DC2626"
          valueDisplay={`${primary.toFixed(1)}%`}
        />

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[8px] text-muted-foreground font-medium">Put Into Portal</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[8px] text-muted-foreground font-medium">On Time</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 mt-0 pt-2">
          <Metric value={activePortal.portal_eligible_orders} label="Eligible" />
          <Metric value={activePortal.portal_used_orders} label="Used" />
          <Metric value={activePortal.portal_on_time_orders} label="On Time" />
          <Metric value={activePortal.portal_used_orders} label="Total" />
        </div>
      </CardContent>

      {/* WTD Comparison Dialog */}
      {weeklyPortal && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Portal Performance Comparison"
        >
          <ComparisonGrid
            daily={
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Put Into Portal %</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                    {portal.put_into_portal_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">On-Time %</p>
                  <p className="text-xl font-bold text-emerald-600 tabular-nums">
                    {portal.in_portal_on_time_percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            }
            wtd={
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Put Into Portal %</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {weeklyPortal.put_into_portal_percent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">On-Time %</p>
                  <p className="text-xl font-bold text-emerald-600 tabular-nums">
                    {weeklyPortal.in_portal_on_time_percent.toFixed(1)}%
                  </p>
                </div>
              </div>
            }
          />
          <ComparisonTable
            rows={[
              {
                label: "Put Into Portal %",
                daily: `${portal.put_into_portal_percent.toFixed(1)}%`,
                wtd: `${weeklyPortal.put_into_portal_percent.toFixed(1)}%`,
                dailyNum: portal.put_into_portal_percent,
                wtdNum: weeklyPortal.put_into_portal_percent,
                higherIsBetter: true,
              },
              {
                label: "On-Time %",
                daily: `${portal.in_portal_on_time_percent.toFixed(1)}%`,
                wtd: `${weeklyPortal.in_portal_on_time_percent.toFixed(1)}%`,
                dailyNum: portal.in_portal_on_time_percent,
                wtdNum: weeklyPortal.in_portal_on_time_percent,
                higherIsBetter: true,
              },
              {
                label: "Eligible Orders",
                daily: `${portal.portal_eligible_orders}`,
                wtd: `${weeklyPortal.portal_eligible_orders}`,
                dailyNum: portal.portal_eligible_orders,
                wtdNum: weeklyPortal.portal_eligible_orders,
                higherIsBetter: true,
              },
              {
                label: "Used Orders",
                daily: `${portal.portal_used_orders}`,
                wtd: `${weeklyPortal.portal_used_orders}`,
                dailyNum: portal.portal_used_orders,
                wtdNum: weeklyPortal.portal_used_orders,
                higherIsBetter: true,
              },
              {
                label: "On-Time Orders",
                daily: `${portal.portal_on_time_orders}`,
                wtd: `${weeklyPortal.portal_on_time_orders}`,
                dailyNum: portal.portal_on_time_orders,
                wtdNum: weeklyPortal.portal_on_time_orders,
                higherIsBetter: true,
              },
            ]}
          />
        </WtdComparisonDialog>
      )}
    </Card>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const to = value;
    const duration = 700;
    const start = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (textRef.current)
        textRef.current.textContent = Math.round(to * easeOut(t)).toLocaleString();
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <div className="text-center space-y-0">
      <div className="flex items-center justify-center gap-0.5">
        <p ref={textRef} className="text-xs font-bold tabular-nums">{value.toLocaleString()}</p>
      </div>
      <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}
