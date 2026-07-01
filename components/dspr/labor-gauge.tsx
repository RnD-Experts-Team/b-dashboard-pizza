"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpeedometerGauge, type SpeedZone } from "./speedometer-gauge";
import { cn } from "@/lib/utils";
import { Gauge, CalendarDays } from "lucide-react";
import { WtdComparisonDialog, ComparisonGrid, ComparisonTable } from "./wtd-comparison-dialog";

interface WeeklyLaborEntry {
  week_start: string;
  week_end: string;
  labor: number | null;
}

// ============================================================================
// Labor zones — symmetric around 19-24% green target
// ============================================================================

const LABOR_ZONES: SpeedZone[] = [
  { from: 0,  to: 10, color: "#EF4444" },
  { from: 10, to: 15, color: "#EAB308" },
  { from: 15, to: 19, color: "#F97316" },
  { from: 19, to: 24, color: "#22C55E" },
  { from: 24, to: 29, color: "#F97316" },
  { from: 29, to: 39, color: "#EAB308" },
  { from: 39, to: 50, color: "#EF4444" },
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
  value: number;
  weeklyValue?: number;
  weeklyAvgValue?: number;
  weeklyLaborEntries?: WeeklyLaborEntry[];
  target?: number;
  title?: string;
  className?: string;
}

export function LaborGauge({
  value,
  weeklyValue,
  weeklyAvgValue,
  weeklyLaborEntries,
  target,
  title = "Labor",
  className,
}: LaborGaugeProps) {
  const [isWeekly, setIsWeekly] = useState(false);
  const [activeTab, setActiveTab] = useState<"labor" | "final">("labor");
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasWeeklyLabor = weeklyLaborEntries && weeklyLaborEntries.length > 0;
  const canOpenDialog = weeklyValue !== undefined || hasWeeklyLabor;
  const activeGaugeValue = isWeekly && weeklyValue !== undefined ? weeklyValue : value;

  const cardTitle = isWeekly
    ? activeTab === "final"
      ? "Final Labor"
      : "Labor (WTD)"
    : title;

  return (
    <Card
      className={cn(
        "group hover:shadow-md transition-shadow py-1.5 gap-0 bg-linear-to-r from-sky-50 via-sky-100 to-sky-200 dark:from-sky-950/20 dark:via-sky-900/40 dark:to-sky-800/50",
        canOpenDialog && "cursor-pointer dspr-card-hover",
        className,
      )}
      onClick={() => canOpenDialog && setDialogOpen(true)}
    >
      <CardHeader className="pb-0 px-3">
        <CardTitle className="text-[11px] font-semibold flex items-center gap-1">
          <div className="rounded p-0.5 bg-sky-500/15 dark:bg-sky-500/20">
            <Gauge className="h-3 w-3 text-sky-500" />
          </div>
          {cardTitle}
          {/* Tab pills — in header row when WTD active */}
          {isWeekly && hasWeeklyLabor && (
            <div
              className="flex gap-0.5 ms-auto bg-muted/60 rounded-md p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className={cn(
                  "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                  activeTab === "labor"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={(e) => { e.stopPropagation(); setActiveTab("labor"); }}
              >
                Labor
              </button>
              <button
                className={cn(
                  "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                  activeTab === "final"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={(e) => { e.stopPropagation(); setActiveTab("final"); }}
              >
                Final
              </button>
            </div>
          )}
          {weeklyValue !== undefined ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-5 w-5 rounded shrink-0",
                    isWeekly ? "bg-primary/15 text-primary" : "text-muted-foreground/40",
                    !isWeekly || !hasWeeklyLabor ? "ms-auto" : "",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsWeekly((v) => !v);
                  }}
                >
                  <CalendarDays className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isWeekly ? "Switch to Daily" : "Switch to Week-to-Date"}
              </TooltipContent>
            </Tooltip>
          ) : target !== undefined ? (
            <span className="text-[9px] font-normal text-muted-foreground ms-auto">
              Target: {target}%
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-1 px-3">

        {/* Speedometer — Daily or WTD Labor */}
        {(!isWeekly || activeTab === "labor") && (
          <>
            <SpeedometerGauge
              value={activeGaugeValue}
              max={50}
              zones={LABOR_ZONES}
              statusLabel={getLaborLabel(activeGaugeValue)}
              statusColor="#DC2626"
              valueDisplay={`${activeGaugeValue}%`}
            />
            <div className="text-center mt-0">
              <p className="text-[9px] text-muted-foreground font-medium">
                Target range:{" "}
                <span className="text-emerald-500 font-semibold">20–24%</span>
              </p>
            </div>
          </>
        )}

        {/* Final Labor — speedometer showing last week's labor */}
        {isWeekly && activeTab === "final" && hasWeeklyLabor && (() => {
          const lastEntry = weeklyLaborEntries[weeklyLaborEntries.length - 1];
          const finalValue = lastEntry.labor ?? 0;
          return (
            <>
              <SpeedometerGauge
                value={finalValue}
                max={50}
                zones={LABOR_ZONES}
                statusLabel={lastEntry.labor != null ? getLaborLabel(finalValue) : "No Data"}
                statusColor="#DC2626"
                valueDisplay={lastEntry.labor != null ? `${finalValue}%` : "—"}
              />
              <div className="text-center mt-0">
                <p className="text-[9px] text-muted-foreground font-medium">
                  Target range:{" "}
                  <span className="text-emerald-500 font-semibold">20–24%</span>
                </p>
              </div>
            </>
          );
        })()}
      </CardContent>

      {/* ── Dialog — daily/WTD details + full Final Labor history ── */}
      {canOpenDialog && (
        <WtdComparisonDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Labor"
          badgeText="Daily · WTD · Final Labor"
        >
          {weeklyValue !== undefined && (
            <>
              <ComparisonGrid
                daily={
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                      {value.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Labor % Today</p>
                    <p className="text-[10px] text-emerald-600 font-medium mt-1">
                      Target: 19–24%
                    </p>
                  </div>
                }
                wtd={
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {weeklyValue.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Labor % WTD</p>
                    {weeklyAvgValue !== undefined && (
                      <p className="text-[10px] text-muted-foreground">
                        WTD Daily Avg:{" "}
                        <span className="font-semibold">
                          {weeklyAvgValue.toFixed(1)}%
                        </span>
                      </p>
                    )}
                    <p className="text-[10px] text-emerald-600 font-medium mt-1">
                      Target: 19–24%
                    </p>
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
                  ...(weeklyAvgValue !== undefined
                    ? [
                        {
                          label: "WTD Daily Avg",
                          daily: "—",
                          wtd: `${weeklyAvgValue.toFixed(1)}%`,
                          dailyNum: 0,
                          wtdNum: weeklyAvgValue,
                          higherIsBetter: false,
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}

          {/* Final Labor — 6-week history */}
          {hasWeeklyLabor && (
            <div className="mt-5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Gauge className="h-3 w-3" />
                Final Labor — 6-Week History
              </h4>
              <div className="space-y-1.5">
                {weeklyLaborEntries.map((entry, i) => {
                  const isCurrentWeek = i === weeklyLaborEntries.length - 1;
                  const weekLabel = `${format(parseISO(entry.week_start), "MMM d")} – ${format(parseISO(entry.week_end), "MMM d")}`;
                  const barPct =
                    entry.labor != null
                      ? Math.min(100, (entry.labor / 50) * 100)
                      : 0;
                  const color =
                    entry.labor != null ? getLaborColor(entry.labor) : undefined;
                  const label =
                    entry.labor != null ? getLaborLabel(entry.labor) : null;
                  return (
                    <div
                      key={entry.week_start}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2",
                        isCurrentWeek
                          ? "bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/40",
                      )}
                    >
                      <span className="text-[10px] text-muted-foreground w-28 shrink-0 tabular-nums">
                        {weekLabel}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        {entry.labor != null && (
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${barPct}%`, backgroundColor: color }}
                          />
                        )}
                      </div>
                      <span
                        className="text-[11px] font-semibold tabular-nums w-12 text-right"
                        style={{ color }}
                      >
                        {entry.labor != null ? `${entry.labor.toFixed(1)}%` : "—"}
                      </span>
                      {label && entry.labor != null && (
                        <span className="text-[9px] text-muted-foreground w-20 text-right hidden sm:block">
                          {label}
                        </span>
                      )}
                      {isCurrentWeek && (
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 h-4 px-1.5 shrink-0"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </WtdComparisonDialog>
      )}
    </Card>
  );
}
