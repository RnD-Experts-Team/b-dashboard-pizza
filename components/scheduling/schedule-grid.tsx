"use client";

import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleEmployee, Shift } from "@/types/scheduling.types";
import {
  DAYS_SHORT,
  formatTime,
  getTimeLabels,
  shiftToPosition,
  SHIFT_COLORS,
  GRID_TOTAL_HOURS,
} from "@/lib/scheduling/data";

interface ScheduleGridProps {
  employees: ScheduleEmployee[];
  shifts: Shift[];
  weekDates: string[]; // 7 date strings like "25" for display
  innerRef?: React.RefObject<HTMLDivElement | null>;
  onDropEmployee: (employeeId: string, dayIndex: number) => void;
  onRemoveShift: (shiftId: string) => void;
  onEditShift: (shift: Shift) => void;
}

/** Detect overlapping shifts within a single day and assign column lanes */
function layoutShiftsInDay(dayShifts: Shift[]): { shift: Shift; col: number; totalCols: number }[] {
  if (dayShifts.length === 0) return [];

  // Sort by start time, then by end time
  const sorted = [...dayShifts].sort((a, b) => {
    const aStart = timeToMin(a.startTime);
    const bStart = timeToMin(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    return timeToMin(a.endTime) - timeToMin(b.endTime);
  });

  // Greedy column assignment
  const columns: { shift: Shift; col: number }[] = [];
  const colEnds: number[] = []; // tracks the end-minute of each column

  for (const s of sorted) {
    const sStart = timeToMin(s.startTime);
    // find first column that ended before this shift starts
    let assigned = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if (colEnds[c] <= sStart) {
        assigned = c;
        break;
      }
    }
    if (assigned === -1) {
      assigned = colEnds.length;
      colEnds.push(0);
    }
    colEnds[assigned] = timeToMin(s.endTime);
    columns.push({ shift: s, col: assigned });
  }

  const totalCols = colEnds.length;
  return columns.map((c) => ({ ...c, totalCols }));
}

function timeToMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  // treat midnight as 24*60
  return h === 0 && m === 0 ? 24 * 60 : h * 60 + m;
}

/** Width in px for a single shift lane inside a day column */
const LANE_WIDTH = 131;
/** Minimum day column width when empty or only 1 shift */
const MIN_COL_WIDTH = LANE_WIDTH;
const TIME_GUTTER_WIDTH = 64; // wide enough for "9:00 AM"

export function ScheduleGrid({
  employees,
  shifts,
  weekDates,
  innerRef,
  onDropEmployee,
  onRemoveShift,
  onEditShift,
}: ScheduleGridProps) {
  const employeeMap = useMemo(() => {
    const map: Record<string, ScheduleEmployee> = {};
    for (const e of employees) map[e.id] = e;
    return map;
  }, [employees]);

  const timeLabels = useMemo(() => getTimeLabels(), []);

  /** Per-day layout with overlap columns computed */
  const dayLayouts = useMemo(() => {
    const result: Record<number, { shift: Shift; col: number; totalCols: number }[]> = {};
    for (let d = 0; d < 7; d++) {
      const dayShifts = shifts.filter((s) => s.dayIndex === d);
      result[d] = layoutShiftsInDay(dayShifts);
    }
    return result;
  }, [shifts]);

  /** Max overlap lanes per day → drives column widths */
  const dayWidths = useMemo(() => {
    const widths: number[] = [];
    for (let d = 0; d < 7; d++) {
      const maxCols = dayLayouts[d]?.reduce((m, l) => Math.max(m, l.totalCols), 0) ?? 0;
      widths.push(Math.max(1, maxCols) * LANE_WIDTH);
    }
    return widths;
  }, [dayLayouts]);

  const totalGridWidth = TIME_GUTTER_WIDTH + dayWidths.reduce((s, w) => s + w, 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    const empId = e.dataTransfer.getData("employee-id");
    if (empId) onDropEmployee(empId, dayIndex);
  };

  // Height of each hour row in px
  const HOUR_HEIGHT = 48;
  const gridHeight = GRID_TOTAL_HOURS * HOUR_HEIGHT;

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden">
      {/* Scrolls both X and Y natively */}
      <div className="h-112.5 overflow-auto">
        <div ref={innerRef} style={{ minWidth: totalGridWidth }}>
          {/* Sticky day headers */}
          <div className="flex sticky top-0 z-20 border-b bg-card">
            {/* Time gutter header — sticky on X scroll */}
            <div
              className="shrink-0 sticky left-0 z-30 border-r px-1 py-2 text-center text-[10px] font-medium text-muted-foreground bg-card"
              style={{ width: TIME_GUTTER_WIDTH }}
            >
              GMT
            </div>
            {/* Day columns headers */}
            {DAYS_SHORT.map((day, i) => (
              <div
                key={day}
                className="shrink-0 border-r last:border-r-0 px-1 py-2 text-center transition-[width] duration-200"
                style={{ width: dayWidths[i] }}
              >
                <p className="text-xs font-semibold">{day}</p>
                <p className="text-lg font-bold leading-tight">{weekDates[i] ?? ""}</p>
              </div>
            ))}
          </div>

          {/* Time grid body */}
          <div className="flex" style={{ height: gridHeight }}>
            {/* Time gutter — sticky on X scroll */}
            <div className="shrink-0 sticky left-0 z-10 border-r relative bg-card" style={{ width: TIME_GUTTER_WIDTH }}>
              {timeLabels.map((label, i) => {
                const topPct = (i / GRID_TOTAL_HOURS) * 100;
                return (
                  <div
                    key={label}
                    className={cn(
                      "absolute w-full text-[10px] text-muted-foreground text-right pr-2",
                      i === 0 ? "" : "-translate-y-1/2"
                    )}
                    style={{ top: i === 0 ? `${topPct + 1}%` : `${topPct}%` }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAYS_SHORT.map((_, dayIndex) => (
              <div
                key={dayIndex}
                className="shrink-0 border-r last:border-r-0 relative transition-[width] duration-200"
                style={{ width: dayWidths[dayIndex] }}
                onDragOver={(e) => {
                  handleDragOver(e);
                  e.currentTarget.dataset.dragOver = "true";
                }}
                onDragLeave={(e) => {
                  e.currentTarget.dataset.dragOver = "false";
                }}
                onDrop={(e) => {
                  handleDrop(e, dayIndex);
                  e.currentTarget.dataset.dragOver = "false";
                }}
                data-drag-over="false"
              >
                {/* Hour grid lines */}
                {timeLabels.map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 border-t border-border/30"
                    style={{ top: `${(i / GRID_TOTAL_HOURS) * 100}%` }}
                  />
                ))}

                {/* Drop overlay */}
                <div className="absolute inset-0 transition-colors data-[drag-over=true]:bg-primary/5 pointer-events-none" />

                {/* Shift blocks — each shift gets a full LANE_WIDTH, positioned in px */}
                {(dayLayouts[dayIndex] ?? []).map(({ shift, col }) => {
                  const emp = employeeMap[shift.employeeId];
                  if (!emp) return null;

                  const pos = shiftToPosition(shift.startTime, shift.endTime);
                  const colorIdx =
                    parseInt(shift.employeeId.replace(/\D/g, ""), 10) % SHIFT_COLORS.length;
                  const color = SHIFT_COLORS[colorIdx];

                  return (
                    <div
                      key={shift.id}
                      className={cn(
                        "absolute rounded-md border px-1.5 py-1 cursor-pointer transition-shadow hover:shadow-lg group overflow-hidden",
                        color.bg,
                        color.border
                      )}
                      style={{
                        top: `${pos.top}%`,
                        height: `${pos.height}%`,
                        left: col * LANE_WIDTH + 2,
                        width: LANE_WIDTH - 4,
                        zIndex: col + 1,
                      }}
                      onClick={() => onEditShift(shift)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-4 w-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveShift(shift.id);
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>

                      <div className="flex items-center gap-1">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-[8px] font-medium bg-transparent",
                              color.text
                            )}
                          >
                            {emp.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn("truncate text-[11px] font-semibold leading-tight", color.text)}>
                          {emp.name}
                        </span>
                      </div>
                      <p className={cn("text-[9px] mt-0.5 leading-tight", color.text, "opacity-80")}>
                        {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                      </p>
                      <Badge
                        variant="secondary"
                        className="mt-0.5 text-[8px] px-1 py-0 h-3.5"
                      >
                        {shift.label}
                      </Badge>
                    </div>
                  );
                })}

                {/* Empty state */}
                {(dayLayouts[dayIndex] ?? []).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[10px] text-muted-foreground/30">Drop here</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
