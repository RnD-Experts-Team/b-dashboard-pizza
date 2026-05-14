"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, ShieldCheck, Clock, CalendarDays } from "lucide-react";
import { SpeedometerGauge } from "./speedometer-gauge";
import type { DsprPortal } from "@/types/dspr.types";
import { cn } from "@/lib/utils";
import { PERFORMANCE_ZONES, getPerformanceLabel, getPerformanceColor } from "./portal-meter-utils";

interface Props {
  portal: DsprPortal;
  className?: string;
}

export function PortalOnTimeDualGauge({ portal, className }: Props) {
  const [isWeekly, setIsWeekly] = useState(false);
  const weeklyPortal = portal.week_to_date;
  const activePortal = isWeekly && weeklyPortal ? weeklyPortal : portal;
  const primary = activePortal.put_into_portal_percent;
  const secondary = activePortal.in_portal_on_time_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50", className)}>
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
                  onClick={() => setIsWeekly((v) => !v)}
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

        <div className="grid grid-cols-4 gap-1 mt-0 pt-2">
          <Metric value={activePortal.portal_eligible_orders} label="Eligible" />
          <Metric value={activePortal.portal_used_orders} label="Used" />
          <Metric value={activePortal.portal_on_time_orders} label="On Time" />
          <Metric value={activePortal.portal_used_orders} label="Total" />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center space-y-0">
      <div className="flex items-center justify-center gap-0.5">
        <p className="text-xs font-bold tabular-nums">{value.toLocaleString()}</p>
      </div>
      <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}
