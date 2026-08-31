"use client";

/**
 * PARKED — not mounted anywhere. The week grid (`schedule-grid-new.tsx`) is the
 * only live schedule view; the week/day/month switcher was removed when the
 * scheduling feature was wired to the OperationsPizza backend.
 *
 * Kept on disk for future use. NOT wired to the API and not maintained beyond
 * keeping it compiling. Known issues to fix if it is ever revived:
 *  - Takes `weekOffset` / `allShifts` / `getWeekDates` and walks arbitrary week
 *    offsets, so it only ever rendered weeks the user had already visited —
 *    most months showed near-empty. A real version needs per-week fetches or a
 *    month-range endpoint (neither exists today).
 *
 * The 9am–midnight time axis it relies on (GRID_START_HOUR / GRID_END_HOUR in
 * lib/scheduling/constants.ts) is hardcoded, but store open/close hours are a
 * per-store API setting — that would need threading through before this is
 * accurate for a store that isn't 9am–midnight.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { calcHours } from "@/lib/scheduling/constants";
import type { Shift } from "@/types/scheduling.types";

/**
 * This view predates `WeekInfo` switching to ISO date strings, and it does
 * calendar arithmetic on `Date` objects throughout. Rather than rework parked
 * code, it keeps its own legacy shape — nothing constructs it any more.
 */
interface LegacyWeekInfo {
  start: Date;
  end: Date;
  label: string;
  dayDates: string[];
  fullDates: Date[];
}

interface MonthOverviewProps {
  weekOffset: number;
  allShifts: Record<number, Shift[]>;
  getWeekDates: (offset: number) => LegacyWeekInfo;
  onNavigateToWeek: (offset: number) => void;
  onNavigateToDay: (offset: number, dayIndex: number) => void;
}

interface DayCell {
  date: Date;
  dayOfMonth: number;
  weekOffset: number;
  dayIndex: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  shiftCount: number;
  totalHours: number;
  uniqueEmployees: number;
}

export function MonthOverview({
  weekOffset,
  allShifts,
  getWeekDates,
  onNavigateToWeek,
  onNavigateToDay,
}: MonthOverviewProps) {
  const { weeks, monthLabel } = useMemo(() => {
    const currentWeek = getWeekDates(weekOffset);
    const month = currentWeek.start.getMonth();
    const year = currentWeek.start.getFullYear();

    // Find the first Tuesday on or before the 1st of the month
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    // Walk back to find the week that contains the first of the month
    let scanWeek = weekOffset;
    while (true) {
      const w = getWeekDates(scanWeek);
      if (w.start <= firstOfMonth) break;
      scanWeek--;
    }

    const weeks: DayCell[][] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let weekOff = scanWeek;
    let done = false;

    while (!done) {
      const w = getWeekDates(weekOff);
      const weekRow: DayCell[] = [];
      const weekShifts = allShifts[weekOff] ?? [];

      for (let di = 0; di < 7; di++) {
        const d = w.fullDates[di];
        const dateNorm = new Date(d);
        dateNorm.setHours(0, 0, 0, 0);
        const isCurrentMonth = d.getMonth() === month;
        const isToday = dateNorm.getTime() === today.getTime();

        const dayShifts = weekShifts.filter((s) => s.dayIndex === di);
        const empSet = new Set(dayShifts.map((s) => s.employeeId));
        const totalHours = dayShifts.reduce(
          (acc, s) => acc + calcHours(s.startTime, s.endTime),
          0
        );

        weekRow.push({
          date: d,
          dayOfMonth: d.getDate(),
          weekOffset: weekOff,
          dayIndex: di,
          isCurrentMonth,
          isToday,
          shiftCount: dayShifts.length,
          totalHours,
          uniqueEmployees: empSet.size,
        });
      }

      weeks.push(weekRow);

      // Stop after we've gone past the end of the month
      if (w.end > lastOfMonth) done = true;
      weekOff++;
    }

    const ml = firstOfMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    return { weeks, monthLabel: ml };
  }, [weekOffset, allShifts, getWeekDates]);

  const maxShifts = useMemo(() => {
    let max = 0;
    for (const w of weeks) {
      for (const d of w) {
        if (d.shiftCount > max) max = d.shiftCount;
      }
    }
    return max || 1;
  }, [weeks]);

  function heatColor(count: number): string {
    if (count === 0) return "bg-muted/30";
    const intensity = count / maxShifts;
    if (intensity > 0.75) return "bg-emerald-200 dark:bg-emerald-900/60";
    if (intensity > 0.5) return "bg-emerald-100 dark:bg-emerald-900/40";
    if (intensity > 0.25) return "bg-emerald-50 dark:bg-emerald-950/40";
    return "bg-emerald-50/60 dark:bg-emerald-950/20";
  }

  const dayHeaders = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Legend */}
        <div className="flex items-center gap-3 mb-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted/30 border" />
            <span>No shifts</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-emerald-50 dark:bg-emerald-950/20 border" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-900/40 border" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/60 border" />
            <span>High</span>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayHeaders.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-1">
          {weeks.map((weekRow, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {weekRow.map((cell) => (
                <Tooltip key={`${cell.weekOffset}-${cell.dayIndex}`}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "relative rounded-md border px-1.5 py-2 text-left transition-all hover:ring-1 hover:ring-primary/40 cursor-pointer",
                        heatColor(cell.shiftCount),
                        !cell.isCurrentMonth && "opacity-40",
                        cell.isToday && "ring-2 ring-primary"
                      )}
                      onClick={() => onNavigateToDay(cell.weekOffset, cell.dayIndex)}
                    >
                      <p
                        className={cn(
                          "text-xs font-medium",
                          cell.isToday
                            ? "text-primary font-bold"
                            : cell.isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {cell.dayOfMonth}
                      </p>
                      {cell.shiftCount > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[9px] font-medium"
                          >
                            {cell.shiftCount}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground hidden sm:inline">
                            {cell.totalHours.toFixed(0)}h
                          </span>
                        </div>
                      )}
                      {cell.shiftCount === 0 && cell.isCurrentMonth && (
                        <p className="text-[9px] text-muted-foreground/50 mt-1">—</p>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">
                      {cell.date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p>
                      {cell.shiftCount} shift{cell.shiftCount !== 1 ? "s" : ""} ·{" "}
                      {cell.totalHours.toFixed(1)}h · {cell.uniqueEmployees} staff
                    </p>
                    <p className="text-muted-foreground">Click to view day</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span>
            Click a day to see detailed schedule •{" "}
            <button
              className="text-primary hover:underline"
              onClick={() => onNavigateToWeek(weekOffset)}
            >
              Back to week view
            </button>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
