"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpeedometerGauge, type SpeedZone } from "./speedometer-gauge";
import { cn } from "@/lib/utils";
import { Gauge, CalendarDays, Construction } from "lucide-react";
import { WtdComparisonDialog, ComparisonGrid, ComparisonTable } from "./wtd-comparison-dialog";

// ============================================================================
// Labor zones — symmetric around 19-24% green target
// ============================================================================

const LABOR_ZONES: SpeedZone[] = [
  { from: 0, to: 10, color: "#EF4444" },  // red – critical low
  { from: 10, to: 15, color: "#EAB308" }, // yellow – low
  { from: 15, to: 19, color: "#F97316" }, // orange – below target
  { from: 19, to: 24, color: "#22C55E" }, // green – on target
  { from: 24, to: 29, color: "#F97316" }, // orange – above target
  { from: 29, to: 39, color: "#EAB308" }, // yellow – high
  { from: 39, to: 50, color: "#EF4444" }, // red – critical high
];

function getLaborColor(value: number): string {
  if (value <= 10) return "#EF4444";
  if (value <= 15) return "#EAB308";
  if (value <= 19) return "#F97316";
  if (value <= 24) return "#22C55E";
  if (value <= 29) return "#F97316";
  if (value <= 39) return "#EAB308";
  return "#EF4444";
}

function getLaborLabel(value: number): string {
  if (value <= 10) return "Critical Low";
  if (value <= 15) return "Low";
  if (value <= 19) return "Below Target";
  if (value <= 24) return "On Target";
  if (value <= 29) return "Above Target";
  if (value <= 39) return "High";
  return "Critical High";
}

// ============================================================================
// Component
// ============================================================================

interface LaborGaugeProps {
  /** Labor percentage value (0-100) */
  value: number;
  /** WTD labor value — enables the Day/WTD toggle */
  weeklyValue?: number;
  /** Target percentage line */
  target?: number;
  title?: string;
  className?: string;
}

export function LaborGauge({
  value,
  weeklyValue,
  target,
  title = "Labor",
  className,
}: LaborGaugeProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const activeValue = isWeekly && weeklyValue !== undefined ? weeklyValue : value;
  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50 relative overflow-hidden", className)}>
      {/* Coming Soon overlay — blocks all interaction */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-xl bg-zinc-900/65 backdrop-blur-[2px]" onClick={(e) => e.stopPropagation()}>
        <Construction className="h-5 w-5 text-zinc-300" />
        <p className="text-[11px] font-bold text-zinc-100 tracking-wide">Coming Soon</p>
        <p className="text-[9px] text-zinc-400">Labor  </p>
      </div>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-sky-500/15 dark:bg-sky-500/20">
            <Gauge className="h-3 w-3 text-sky-500" />
          </div>
          {isWeekly ? "Labor (WTD)" : title}
          {weeklyValue !== undefined ? (
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
          ) : target !== undefined ? (
            <span className="text-[9px] font-normal text-muted-foreground ms-auto">
              Target: {target}%
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={activeValue}
          max={50}
          zones={LABOR_ZONES}
          statusLabel={getLaborLabel(activeValue)}
          statusColor="#DC2626"
          valueDisplay={`${activeValue}%`}
        />
        <div className="text-center mt-0">
          <p className="text-[9px] text-muted-foreground font-medium">
            Target range:{" "}
            <span className="text-emerald-500 font-semibold">20–24%</span>
          </p>
        </div>
      </CardContent>

      {/* WTD Comparison Dialog */}
      {weeklyValue !== undefined && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Labor Comparison"
        >
          <ComparisonGrid
            daily={
              <div className="space-y-2">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  {value.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">Labor % Today</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-1">Target: 19–24%</p>
              </div>
            }
            wtd={
              <div className="space-y-2">
                <p className="text-2xl font-bold text-primary tabular-nums">
                  {weeklyValue.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">Labor % WTD Avg</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-1">Target: 19–24%</p>
              </div>
            }
          />
          <ComparisonTable
            rows={[
              {
                label: "Labor %",
                daily: `${value.toFixed(1)}%`,
                wtd: `${weeklyValue.toFixed(1)}%`,
                dailyNum: value,
                wtdNum: weeklyValue,
                higherIsBetter: false,
              },
            ]}
          />
        </WtdComparisonDialog>
      )}
    </Card>
  );
}
