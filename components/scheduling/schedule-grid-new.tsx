"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DAYS_SHORT, calcHours, EMPLOYEE_COLORS } from "@/lib/scheduling/data";
import { ShiftCard } from "./shift-card";
import type { ScheduleEmployee, Shift, WeekInfo } from "@/types/scheduling.types";

interface ScheduleGridProps {
  employees: ScheduleEmployee[];
  shifts: Shift[];
  week: WeekInfo;
  onAddShift: (employeeId: string, dayIndex: number) => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (shiftId: string) => void;
}

export function ScheduleGrid({
  employees,
  shifts,
  week,
  onAddShift,
  onEditShift,
  onDeleteShift,
}: ScheduleGridProps) {
  // Group shifts by employee + day for O(1) lookup
  const shiftMap = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shifts) {
      const key = `${s.employeeId}-${s.dayIndex}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [shifts]);

  // Per-employee weekly hours
  const hoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + calcHours(s.startTime, s.endTime);
    }
    return map;
  }, [shifts]);

  // Per-employee shift counts
  const shiftCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of shifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + 1;
    }
    return map;
  }, [shifts]);

  // Today highlight: find which dayIndex (0=Tue..6=Mon) is today
  const todayIndex = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(week.fullDates[i]);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) return i;
    }
    return -1;
  }, [week.fullDates]);

  // Per-day totals
  const dayTotals = useMemo(() => {
    const totals: { hours: number; shifts: number }[] = Array.from({ length: 7 }, () => ({
      hours: 0,
      shifts: 0,
    }));
    for (const s of shifts) {
      if (s.dayIndex >= 0 && s.dayIndex < 7) {
        totals[s.dayIndex].hours += calcHours(s.startTime, s.endTime);
        totals[s.dayIndex].shifts += 1;
      }
    }
    return totals;
  }, [shifts]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Horizontal scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-225 border-collapse">
          {/* Header row */}
          <thead>
            <tr className="border-b bg-muted/30">
              {/* Employee column header */}
              <th className="sticky left-0 z-20 bg-muted/30 backdrop-blur-sm w-55 min-w-55 border-r px-3 py-2.5 text-left">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Employee
                </span>
              </th>

              {/* Day columns */}
              {DAYS_SHORT.map((day, i) => (
                <th
                  key={day}
                  className={cn(
                    "min-w-32.5 border-r last:border-r-0 px-2 py-2.5 text-center",
                    todayIndex === i && "bg-primary/5"
                  )}
                >
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {day}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold leading-tight mt-0.5",
                      todayIndex === i
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {week.dayDates[i] ?? ""}
                  </p>
                  {todayIndex === i && (
                    <div className="mx-auto mt-1 h-0.5 w-6 rounded-full bg-primary" />
                  )}
                </th>
              ))}

              {/* Hours column */}
              <th className="w-20 min-w-20 px-2 py-2.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hours
                </span>
              </th>
            </tr>
          </thead>

          {/* Employee rows */}
          <tbody>
            {employees.map((emp) => {
              const empHours = hoursMap[emp.id] ?? 0;
              const empShiftCount = shiftCountMap[emp.id] ?? 0;
              const palette = EMPLOYEE_COLORS[emp.color] ?? EMPLOYEE_COLORS.blue;

              return (
                <tr
                  key={emp.id}
                  className="border-b last:border-b-0 hover:bg-muted/10 transition-colors"
                >
                  {/* Employee info — sticky left */}
                  <td className="sticky left-0 z-10 bg-card border-r px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            palette.bg,
                            palette.text
                          )}
                        >
                          {emp.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-tight truncate">
                          {emp.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {emp.role}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {DAYS_SHORT.map((_, dayIdx) => {
                    const key = `${emp.id}-${dayIdx}`;
                    const cellShifts = shiftMap[key] ?? [];

                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          "border-r last:border-r-0 px-1.5 py-1.5 align-top min-h-15",
                          todayIndex === dayIdx && "bg-primary/2"
                        )}
                      >
                        <div className="flex flex-col gap-1 min-h-13">
                          {/* Existing shifts */}
                          {cellShifts.map((shift) => (
                            <ShiftCard
                              key={shift.id}
                              shift={shift}
                              color={emp.color}
                              onEdit={onEditShift}
                              onDelete={onDeleteShift}
                            />
                          ))}

                          {/* Add shift button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "h-6 w-full border border-dashed border-transparent text-muted-foreground/40",
                                  "hover:border-primary/30 hover:text-primary hover:bg-primary/5",
                                  "transition-all",
                                  cellShifts.length === 0 && "mt-2"
                                )}
                                onClick={() => onAddShift(emp.id, dayIdx)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Add shift for {emp.name}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    );
                  })}

                  {/* Hours total */}
                  <td className="px-2 py-2 text-center">
                    <p className="text-sm font-semibold">
                      {empHours > 0 ? `${empHours.toFixed(1)}h` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {empShiftCount > 0 ? `${empShiftCount} shift${empShiftCount > 1 ? "s" : ""}` : ""}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Footer totals row */}
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td className="sticky left-0 z-10 bg-muted/20 border-r px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Daily Totals
                </span>
              </td>
              {DAYS_SHORT.map((_, i) => (
                <td
                  key={i}
                  className={cn(
                    "border-r last:border-r-0 px-2 py-2 text-center",
                    todayIndex === i && "bg-primary/5"
                  )}
                >
                  <p className="text-xs font-semibold">
                    {dayTotals[i].hours > 0
                      ? `${dayTotals[i].hours.toFixed(1)}h`
                      : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dayTotals[i].shifts > 0
                      ? `${dayTotals[i].shifts} shift${dayTotals[i].shifts > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </td>
              ))}
              <td className="px-2 py-2 text-center">
                <p className="text-xs font-bold">
                  {shifts.length > 0
                    ? `${shifts.reduce((t, s) => t + calcHours(s.startTime, s.endTime), 0).toFixed(1)}h`
                    : "—"}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
