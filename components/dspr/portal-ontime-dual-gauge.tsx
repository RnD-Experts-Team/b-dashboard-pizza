"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ShieldCheck, Clock } from "lucide-react";
import { SpeedometerGauge } from "./speedometer-gauge";
import type { DsprPortal } from "@/types/dspr.types";
import { cn } from "@/lib/utils";
import { PERFORMANCE_ZONES, getPerformanceLabel, getPerformanceColor } from "./portal-meter-utils";

interface Props {
  portal: DsprPortal;
  className?: string;
}

export function PortalOnTimeDualGauge({ portal, className }: Props) {
  const primary = portal.put_into_portal_percent;
  const secondary = portal.in_portal_on_time_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-gradient-to-r from-emerald-50/50 via-emerald-100/40 to-emerald-200/30 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-emerald-500/15 dark:bg-emerald-500/20">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
          </div>
          Portal Performance
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground ms-auto cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-50">
              Combined view: portal usage and on-time rate in one card
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={primary}
          secondaryValue={secondary}
          secondaryColor="#EF4444"
          secondaryLabel="On Time"
          zones={PERFORMANCE_ZONES}
          statusLabel={getPerformanceLabel(primary)}
          statusColor={getPerformanceColor(primary)}
          valueDisplay={`${primary.toFixed(1)}%`}
        />

        <div className="grid grid-cols-4 gap-1 mt-0 pt-2">
          <Metric value={portal.portal_eligible_orders} label="Eligible" />
          <Metric value={portal.portal_used_orders} label="Used" />
          <Metric value={portal.portal_on_time_orders} label="On Time" />
          <Metric value={portal.portal_used_orders} label="Total" />
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
