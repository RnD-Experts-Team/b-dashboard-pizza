"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { SpeedometerGauge, type SpeedZone } from "@/components/dspr/speedometer-gauge";
import {
  WtdComparisonDialog,
  ComparisonGrid,
} from "@/components/dspr/wtd-comparison-dialog";
import { cn } from "@/lib/utils";
import { CalendarDays, Gauge } from "lucide-react";
import { V1Card } from "../v1-card";
import { V1Toggle } from "../v1-ui";

export interface WeeklyLaborEntry {
  week_start: string;
  week_end: string;
  labor: number | null;
  total_hours: number;
}

/* Labor zones — symmetric around the 19–24% green target (0–50 scale). */
const LABOR_ZONES: SpeedZone[] = [
  { from: 0,  to: 10, color: "#EF4444" },
  { from: 10, to: 15, color: "#EAB308" },
  { from: 15, to: 19, color: "#F97316" },
  { from: 19, to: 24, color: "#22C55E" },
  { from: 24, to: 29, color: "#F97316" },
  { from: 29, to: 39, color: "#EAB308" },
  { from: 39, to: 50, color: "#EF4444" },
];

function laborLabel(v: number): string {
  if (v <= 10) return "Critical Low";
  if (v <= 15) return "Low";
  if (v <= 19) return "Below Target";
  if (v <= 24) return "On Target";
  if (v <= 29) return "Above Target";
  if (v <= 39) return "High";
  return "Critical High";
}

function laborColor(v: number): string {
  if (v <= 10) return "#EF4444";
  if (v <= 15) return "#EAB308";
  if (v <= 19) return "#F97316";
  if (v <= 24) return "#22C55E";
  if (v <= 29) return "#F97316";
  if (v <= 39) return "#EAB308";
  return "#EF4444";
}

export function V1LaborCard({
  value,
  weeklyValue,
  weeklyAvgValue,
  weeklyLaborEntries,
  laborWeekToDateByDay,
  span,
  className,
}: {
  value: number;
  weeklyValue?: number;
  weeklyAvgValue?: number;
  weeklyLaborEntries?: WeeklyLaborEntry[];
  laborWeekToDateByDay?: Record<string, { value: number; percent: number }>;
  span?: 1 | 2 | 3;
  className?: string;
}) {
  const hasWeekly = weeklyValue !== undefined;
  const hasWeeklyLabor = weeklyLaborEntries && weeklyLaborEntries.length > 0;
  const hasLaborByDay = laborWeekToDateByDay && Object.keys(laborWeekToDateByDay).length > 0;
  const canExpand = hasWeekly || !!hasWeeklyLabor;

  const [view, setView] = useState<"day" | "wtd">("day");
  const [activeTab, setActiveTab] = useState<"labor" | "final">("labor");
  const [open, setOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"by-day" | "final">("by-day");

  const isWtd = view === "wtd" && hasWeekly;
  const activeGaugeValue = isWtd ? weeklyValue! : value;

  // Final Labor — last weekly-labor entry
  const lastEntry = hasWeeklyLabor
    ? weeklyLaborEntries[weeklyLaborEntries.length - 1]
    : null;
  const finalValue = lastEntry?.labor ?? 0;

  return (
    <V1Card
      title="Labor"
      category="operations"
      period={hasWeekly ? "D·WTD" : "D"}
      span={span}
      className={className}
      bodyClassName="overflow-hidden"
      onExpand={canExpand ? () => setOpen(true) : undefined}
      headerControl={
        hasWeekly ? (
          <div
            className="flex items-center gap-1 ms-1"
            onClick={(e) => e.stopPropagation()}
          >
            <V1Toggle
              options={[
                { value: "day", label: "Day" },
                { value: "wtd", label: "WTD" },
              ]}
              value={view}
              onChange={(v) => {
                setView(v as "day" | "wtd");
                if (v === "day") setActiveTab("labor");
              }}
            />
            {isWtd && hasWeeklyLabor && (
              <div className="flex gap-0.5 bg-muted/60 rounded-md p-0.5">
                <button
                  className={cn(
                    "text-[9px] font-medium rounded px-1.5 py-0.5 transition-colors",
                    activeTab === "labor"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab("labor")}
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
                  onClick={() => setActiveTab("final")}
                >
                  Final
                </button>
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col">
        <div className="mx-auto w-full max-w-[260px]">
          {/* Daily or WTD Labor */}
          {(!isWtd || activeTab === "labor") && (
            <SpeedometerGauge
              value={activeGaugeValue}
              max={50}
              zones={LABOR_ZONES}
              statusLabel={laborLabel(activeGaugeValue)}
              statusColor="#DC2626"
              valueDisplay={`${activeGaugeValue.toFixed(1)}%`}
            />
          )}
          {/* Final Labor — last weekly-labor entry */}
          {isWtd && activeTab === "final" && lastEntry && (
            <SpeedometerGauge
              value={finalValue}
              max={50}
              zones={LABOR_ZONES}
              statusLabel={lastEntry.labor != null ? laborLabel(finalValue) : "No Data"}
              statusColor="#DC2626"
              valueDisplay={lastEntry.labor != null ? `${finalValue.toFixed(1)}%` : "—"}
            />
          )}
        </div>
        <p className="text-center text-[9px] font-medium text-muted-foreground">
          Target range:{" "}
          <span className="font-semibold text-emerald-500">19–24%</span>
        </p>
      </div>

      {/* Dialog */}
      {canExpand && (
        <WtdComparisonDialog
          open={open}
          onClose={() => setOpen(false)}
          title="Labor"
          badgeText="Daily · WTD · Final Labor"
        >
        <div className="h-[560px] overflow-y-auto pr-1">
          {hasWeekly && (
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
                    {(weeklyAvgValue ?? weeklyValue!).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Labor % (WTD Avg)</p>
                  <p className="text-[10px] text-emerald-600 font-medium mt-1">
                    Target: 19–24%
                  </p>
                </div>
              }
            />
          )}

          {/* Labor by Day / Final Labor — tabs when both are available */}
          {hasLaborByDay && hasWeeklyLabor && (
            <div className="mt-5 flex gap-1 rounded-md bg-muted/60 p-0.5 w-fit">
              <button
                className={cn(
                  "text-[10px] font-medium rounded px-2.5 py-1 transition-colors",
                  dialogTab === "by-day"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDialogTab("by-day")}
              >
                Labor by Day
              </button>
              <button
                className={cn(
                  "text-[10px] font-medium rounded px-2.5 py-1 transition-colors",
                  dialogTab === "final"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setDialogTab("final")}
              >
                Final Labor
              </button>
            </div>
          )}

          {/* Labor by Day — WTD breakdown */}
          {laborWeekToDateByDay && Object.keys(laborWeekToDateByDay).length > 0 && (!hasWeeklyLabor || dialogTab === "by-day") && (
            <div className="mt-5">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                Labor by Day — Week to Date
              </h4>
              <div className="space-y-1.5">
                {Object.entries(laborWeekToDateByDay)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dateStr, entry]) => {
                    const barPct = Math.min(100, (entry.percent / 50) * 100);
                    const color = laborColor(entry.percent);
                    const label = laborLabel(entry.percent);
                    const dayLabel = (() => {
                      try {
                        return format(parseISO(dateStr), "EEE, MMM d");
                      } catch {
                        return dateStr;
                      }
                    })();
                    return (
                      <div
                        key={dateStr}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted/40"
                      >
                        <span className="text-[10px] text-muted-foreground w-28 shrink-0">
                          {dayLabel}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barPct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span
                          className="text-[11px] font-semibold tabular-nums w-12 text-right"
                          style={{ color }}
                        >
                          {entry.percent.toFixed(1)}%
                        </span>
                        {entry.value !== 0 && (
                          <span className="text-[9px] text-muted-foreground w-16 text-right tabular-nums hidden sm:block">
                            {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(entry.value)}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground w-20 text-right hidden sm:block">
                          {label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Final Labor — 6-week history */}
          {hasWeeklyLabor && (!hasLaborByDay || dialogTab === "final") && (
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
                    entry.labor != null ? laborColor(entry.labor) : undefined;
                  const label =
                    entry.labor != null ? laborLabel(entry.labor) : null;
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
                      {entry.total_hours > 0 && (
                        <span className="text-[12px] font-semibold text-foreground w-16 text-right tabular-nums hidden sm:block">
                          {entry.total_hours.toFixed(1)} hrs
                        </span>
                      )}
                      {label && entry.labor != null && (
                        <span className="text-[9px] text-muted-foreground w-20 text-right hidden sm:block">
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </WtdComparisonDialog>
      )}
    </V1Card>
  );
}
