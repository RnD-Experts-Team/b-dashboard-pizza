"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeedometerGauge, type SpeedZone } from "./speedometer-gauge";
import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";

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
  /** Target percentage line */
  target?: number;
  title?: string;
  className?: string;
}

export function LaborGauge({
  value,
  target,
  title = "Labor",
  className,
}: LaborGaugeProps) {
  return (
    <Card className={cn("group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-sky-50/50 via-sky-100/40 to-sky-200/30 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50", className)}>
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-sky-500/15 dark:bg-sky-500/20">
            <Gauge className="h-3 w-3 text-sky-500" />
          </div>
          {title}
          {target !== undefined && (
            <span className="text-[9px] font-normal text-muted-foreground ml-auto">
              Target: {target}%
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-1 px-3">
        <SpeedometerGauge
          value={value}
          max={50}
          zones={LABOR_ZONES}
          statusLabel={getLaborLabel(value)}
          statusColor="#DC2626"
          valueDisplay={`${value}%`}
        />
        <div className="text-center mt-0">
          <p className="text-[9px] text-muted-foreground font-medium">
            Target range:{" "}
            <span className="text-emerald-500 font-semibold">20–24%</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
