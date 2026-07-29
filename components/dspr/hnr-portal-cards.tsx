"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpeedometerGauge, type SpeedZone } from "./speedometer-gauge";
import type { DsprHnr, DsprPortal } from "@/types/dspr.types";
import {
  Timer,
  ShieldCheck,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WtdComparisonDialog, ComparisonGrid, ComparisonTable } from "./wtd-comparison-dialog";

// ============================================================================
// Shared performance zones & helpers
// ============================================================================

const PERFORMANCE_ZONES: SpeedZone[] = [
  { from: 0, to: 70, color: "#EF4444" },   // red – critical
  { from: 70, to: 85, color: "#EAB308" },  // yellow – needs attention
  { from: 85, to: 95, color: "#F97316" },  // orange – good
  { from: 95, to: 100, color: "#22C55E" }, // green – excellent
];

function getPerformanceColor(value: number): string {
  if (value >= 95) return "#22C55E";
  if (value >= 85) return "#F97316";
  if (value >= 70) return "#EAB308";
  return "#EF4444";
}

function getPerformanceLabel(value: number): string {
  if (value >= 95) return "Excellent";
  if (value >= 85) return "Good";
  if (value >= 70) return "Needs Attention";
  return "Critical";
}


//HNR zones and helpers 

const LABOR_ZONES: SpeedZone[] = [
   { from: 0, to: 60, color: "#EF4444" },
  { from: 60, to: 70, color: "#EAB308" },
  { from: 70, to: 90, color: "#F97316" },
  { from: 90, to: 100, color: "#22C55E" }, // only green zone
];
function getLaborColor(value: number): string {
  if (value <= 35) return "#EF4444";
  if (value <= 42) return "#EAB308";
  if (value <= 50) return "#F97316";
  if (value <= 70) return "#22C55E";
  if (value <= 77) return "#F97316";
  if (value <= 85) return "#EAB308";
  return "#EF4444";
}

function getLaborLabel(value: number): string {
  if (value <= 35) return "Critical Low";
  if (value <= 42) return "Low";
  if (value <= 50) return "Below Target";
  if (value <= 70) return "On Target";
  if (value <= 77) return "Above Target";
  if (value <= 85) return "High";
  return "Critical High";
}

// ============================================================================
// HNR (Hot-N-Ready) Card
// ============================================================================

interface HnrCardProps {
  hnr: DsprHnr;
  weeklyHnr?: DsprHnr;
  weeklyAvgHnr?: DsprHnr;
  importantItemsHnr?: DsprHnr;
  weeklyImportantItemsHnr?: DsprHnr;
  weeklyAvgImportantItemsHnr?: DsprHnr;
  className?: string;
}

export function HnrCard({
  hnr,
  weeklyHnr,
  weeklyAvgHnr,
  importantItemsHnr,
  weeklyImportantItemsHnr,
  weeklyAvgImportantItemsHnr,
  className,
}: HnrCardProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [itemsMode, setItemsMode] = useState<"all" | "special">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  // Independent from the card's own All/Special toggle — switching one does not affect the other.
  const [dialogItemsMode, setDialogItemsMode] = useState<"all" | "special">("all");
  const hasSpecialItems = Boolean(importantItemsHnr);

  const source =
    itemsMode === "special"
      ? {
          day: importantItemsHnr ?? hnr,
          wtd: weeklyImportantItemsHnr,
          wtdAvg: weeklyAvgImportantItemsHnr,
        }
      : { day: hnr, wtd: weeklyHnr, wtdAvg: weeklyAvgHnr };
  const activeHnr = isWeekly && source.wtd ? source.wtdAvg ?? source.wtd : source.day;
  const pct = activeHnr.hnr_promise_met_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-orange-50 via-orange-100 to-orange-200 dark:from-orange-950/20 dark:via-orange-900/40 dark:to-orange-800/50", weeklyHnr && "cursor-pointer dspr-card-hover", className)} onClick={() => weeklyHnr && setDialogOpen(true)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-orange-500/15 dark:bg-orange-500/20">
            <Timer className="h-3 w-3 text-orange-500" />
          </div>
          Hot-N-Ready{isWeekly ? " (WTD)" : ""}{itemsMode === "special" ? " · Special Items" : ""}
          <div className="ms-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {hasSpecialItems && (
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                <button
                  className={cn(
                    "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                    itemsMode === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setItemsMode("all")}
                >
                  All
                </button>
                <button
                  className={cn(
                    "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                    itemsMode === "special"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setItemsMode("special")}
                >
                  Special
                </button>
              </div>
            )}
            {weeklyHnr ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-5 w-5 rounded", isWeekly ? "bg-primary/15 text-primary" : "text-muted-foreground/40")}
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
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-50">
                  Tracks how well HNR promises are being met
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3 flex flex-col gap-8">
        <SpeedometerGauge
          value={pct}
          zones={LABOR_ZONES}
          statusLabel={getLaborLabel(pct)}
          statusColor={getLaborColor(pct)}
          valueDisplay={`${pct}%`}
          max={100}
        />
        <div className="grid grid-cols-3 gap-1 mt-0">
          <Metric
            icon={<Timer className="h-2.5 w-2.5 text-muted-foreground" />}
            value={activeHnr.hnr_transactions}
            label="Trans."
          />
          <Metric
            icon={<CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />}
            value={activeHnr.hnr_promise_met}
            label="Kept"
          />
          <Metric
            icon={<XCircle className="h-2.5 w-2.5 text-red-500" />}
            value={activeHnr.hnr_broken_promises}
            label="Broken"
            highlight={activeHnr.hnr_broken_promises > 0}
          />
        </div>
      </CardContent>

      {/* WTD Comparison Dialog */}
      {weeklyHnr && (() => {
        const dailyHnr = dialogItemsMode === "special" ? importantItemsHnr ?? hnr : hnr;
        const avgHnr =
          dialogItemsMode === "special"
            ? weeklyAvgImportantItemsHnr ?? weeklyImportantItemsHnr ?? weeklyAvgHnr ?? weeklyHnr
            : weeklyAvgHnr ?? weeklyHnr;
        return (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Hot-N-Ready Comparison"
          badgeText={dialogItemsMode === "special" ? "Special Items · Daily vs WTD Avg" : "All Items · Daily vs WTD Avg"}
        >
          {hasSpecialItems && (
            <div
              className="mb-3 flex justify-end"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex gap-0.5 rounded-md bg-muted/60 p-0.5">
                <button
                  className={cn(
                    "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                    dialogItemsMode === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setDialogItemsMode("all")}
                >
                  All Items
                </button>
                <button
                  className={cn(
                    "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                    dialogItemsMode === "special"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setDialogItemsMode("special")}
                >
                  Special Items
                </button>
              </div>
            </div>
          )}
          <ComparisonGrid
            daily={
              <div className="space-y-2">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {dailyHnr.hnr_promise_met_percent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">Promise Met</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[11px]">Trans: <b>{dailyHnr.hnr_transactions}</b></span>
                  <span className="text-[11px]">Kept: <b>{dailyHnr.hnr_promise_met}</b></span>
                  <span className="text-[11px]">Broken: <b>{dailyHnr.hnr_broken_promises}</b></span>
                </div>
              </div>
            }
            wtd={
              <div className="space-y-2">
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {avgHnr.hnr_promise_met_percent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">Promise Met (Avg)</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[11px]">Trans: <b>{avgHnr.hnr_transactions}</b></span>
                  <span className="text-[11px]">Kept: <b>{avgHnr.hnr_promise_met}</b></span>
                  <span className="text-[11px]">Broken: <b>{avgHnr.hnr_broken_promises}</b></span>
                </div>
              </div>
            }
          />
          <ComparisonTable
            rows={[
              {
                label: "Promise Met %",
                daily: `${dailyHnr.hnr_promise_met_percent.toFixed(1)}%`,
                wtd: `${avgHnr.hnr_promise_met_percent.toFixed(1)}%`,
                dailyNum: dailyHnr.hnr_promise_met_percent,
                wtdNum: avgHnr.hnr_promise_met_percent,
                higherIsBetter: true,
              },
              {
                label: "Transactions",
                daily: `${dailyHnr.hnr_transactions}`,
                wtd: `${avgHnr.hnr_transactions}`,
                dailyNum: dailyHnr.hnr_transactions,
                wtdNum: avgHnr.hnr_transactions,
                higherIsBetter: true,
              },
              {
                label: "Promises Kept",
                daily: `${dailyHnr.hnr_promise_met}`,
                wtd: `${avgHnr.hnr_promise_met}`,
                dailyNum: dailyHnr.hnr_promise_met,
                wtdNum: avgHnr.hnr_promise_met,
                higherIsBetter: true,
              },
              {
                label: "Broken Promises",
                daily: `${dailyHnr.hnr_broken_promises}`,
                wtd: `${avgHnr.hnr_broken_promises}`,
                dailyNum: dailyHnr.hnr_broken_promises,
                wtdNum: avgHnr.hnr_broken_promises,
                higherIsBetter: false,
              },
            ]}
          />
        </WtdComparisonDialog>
        );
      })()}
    </Card>
  );
}

// ============================================================================
// Portal Performance Card
// ============================================================================

interface PortalCardProps {
  portal: DsprPortal;
  className?: string;
}

export function PortalCard({ portal, className }: PortalCardProps) {
  const pct = portal.put_into_portal_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5  gap-0 bg-linear-to-r from-emerald-50/50 via-emerald-100/40 to-emerald-200/30 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-emerald-500/15 dark:bg-emerald-500/20">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
          </div>
          Put Into Portal 
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground ms-auto cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-50">
              Measures portal usage rate for eligible orders
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={pct}
          zones={PERFORMANCE_ZONES}
          statusLabel={getPerformanceLabel(pct)}
          statusColor={getPerformanceColor(pct)}
          valueDisplay={`${pct.toFixed(1)}%`}
        />
        <div className="grid grid-cols-2 gap-1 mt-0">
          <Metric value={portal.portal_eligible_orders} label="Eligible" />
          <Metric value={portal.portal_used_orders} label="Used" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// On Time Card
// ============================================================================

interface OnTimeCardProps {
  portal: DsprPortal;
  className?: string;
}

export function OnTimeCard({ portal, className }: OnTimeCardProps) {
  const pct = portal.in_portal_on_time_percent;

  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0  bg-linear-to-r from-emerald-50/50 via-emerald-100/40 to-emerald-200/30 dark:from-emerald-950/20 dark:via-emerald-900/40 dark:to-emerald-800/50  ", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-emerald-500/15 dark:bg-emerald-500/20">
            <Clock className="h-3 w-3 text-emerald-500" />
          </div>
          Portal On Time 
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground ms-auto cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-50">
              On-time completion rate for portal orders
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={pct}
          zones={PERFORMANCE_ZONES}
          statusLabel={getPerformanceLabel(pct)}
          statusColor={getPerformanceColor(pct)}
          valueDisplay={`${pct.toFixed(1)}%`}
        />
        <div className="grid grid-cols-2 gap-1 mt-0">
          <Metric value={portal.portal_on_time_orders} label="On Time" />
          <Metric value={portal.portal_used_orders} label="Total" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Shared metric helper
// ============================================================================

function Metric({
  value,
  label,
  icon,
  highlight,
}: {
  value: number;
  label: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
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
        {icon}
        <p
          ref={textRef}
          className={cn(
            "text-xs font-bold tabular-nums",
            highlight && "text-red-600 dark:text-red-400",
          )}
        >
          {value.toLocaleString()}
        </p>
      </div>
      <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
