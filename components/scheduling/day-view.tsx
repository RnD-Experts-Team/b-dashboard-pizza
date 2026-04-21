"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  calcHours,
  formatTime,
  EMPLOYEE_COLORS,
  getTimeLabels,
  shiftToPosition,
} from "@/lib/scheduling/data";
import type {
  ScheduleEmployee,
  Shift,
  AvailabilityRule,
  TimeOffEntry,
  WeekInfo,
} from "@/types/scheduling.types";
import { EmployeeProfileDialog } from "./employee-profile-dialog";

interface DayViewProps {
  employees: ScheduleEmployee[];
  shifts: Shift[];
  dayIndex: number;
  week: WeekInfo;
  conflictIds: Set<string>;
  overtimeEmpIds: Set<string>;
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  onAddShift: (employeeId: string, dayIndex: number) => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (shiftId: string) => void;
  onEmployeeClick?: (employee: ScheduleEmployee) => void;
}

const HOUR_HEIGHT = 60; // px per hour
const timeLabels = getTimeLabels();

export function DayView({
  employees,
  shifts,
  dayIndex,
  week,
  conflictIds,
  overtimeEmpIds,
  availability,
  timeOff,
  onAddShift,
  onEditShift,
  onEmployeeClick,
}: DayViewProps) {
  const [profileEmp, setProfileEmp] = useState<ScheduleEmployee | null>(null);
  const dayShiftsByEmp = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shifts) {
      if (s.dayIndex === dayIndex) {
        if (!map[s.employeeId]) map[s.employeeId] = [];
        map[s.employeeId].push(s);
      }
    }
    return map;
  }, [shifts, dayIndex]);

  const totalHours = GRID_END_HOUR - GRID_START_HOUR;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="flex min-w-225">
          {/* Time axis */}
          <div className="w-16 shrink-0 border-r bg-muted/30">
            <div className="h-12 border-b" />
            <div className="relative" style={{ height: gridHeight }}>
              {timeLabels.map((label, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-start px-2"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <span className="text-[10px] text-muted-foreground -translate-y-1/2">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Employee columns */}
          {employees.map((emp) => {
            const empShifts = dayShiftsByEmp[emp.id] ?? [];
            const palette = EMPLOYEE_COLORS[emp.color] ?? EMPLOYEE_COLORS.blue;
            const isOvertime = overtimeEmpIds.has(emp.id);
            const empAvail = availability.filter(
              (r) => r.employeeId === emp.id && r.dayIndex === dayIndex
            );
            const empTimeOff = timeOff.find(
              (t) => t.employeeId === emp.id && t.dayIndex === dayIndex
            );

            return (
              <div key={emp.id} className="flex-1 min-w-36 border-r last:border-r-0">
                {/* Header */}
                <div
                  className={cn(
                    "h-12 border-b flex items-center gap-2 px-2",
                    isOvertime && "bg-amber-50 dark:bg-amber-950/20"
                  )}
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback
                      className={cn("text-[9px] font-semibold", palette.bg, palette.text)}
                    >
                      {emp.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-xs font-medium truncate text-left hover:underline hover:text-primary transition-colors cursor-pointer block w-full"
                      onClick={() => {
                        setProfileEmp(emp);
                        onEmployeeClick?.(emp);
                      }}
                    >
                      {emp.name}
                    </button>
                    {isOvertime && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">
                        OT
                      </span>
                    )}
                  </div>
                </div>

                {/* Time grid */}
                <div
                  className="relative"
                  style={{ height: gridHeight }}
                  onClick={() => onAddShift(emp.id, dayIndex)}
                >
                  {/* Hour lines */}
                  {Array.from({ length: totalHours + 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-dashed border-border/40"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Time-off overlay */}
                  {empTimeOff && (
                    <div className="absolute inset-0 bg-purple-100/60 dark:bg-purple-900/30 z-5 flex items-center justify-center">
                      <div className="rounded-md bg-purple-200 dark:bg-purple-800 px-3 py-1.5 text-center">
                        <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                          {empTimeOff.label}
                        </p>
                        <p className="text-[10px] text-purple-600 dark:text-purple-300">
                          All Day
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Availability blocks */}
                  {!empTimeOff &&
                    empAvail.map((rule) => {
                      if (rule.allDay) {
                        return (
                          <div
                            key={rule.id}
                            className="absolute inset-0 bg-slate-200/60 dark:bg-slate-800/40 z-5"
                          >
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Unavailable
                              </span>
                            </div>
                          </div>
                        );
                      }
                      if (!rule.startTime || !rule.endTime) return null;
                      const pos = shiftToPosition(rule.startTime, rule.endTime);
                      return (
                        <div
                          key={rule.id}
                          className="absolute left-1 right-1 rounded bg-slate-200/70 dark:bg-slate-800/50 z-5 flex items-center justify-center"
                          style={{
                            top: `${pos.top}%`,
                            height: `${pos.height}%`,
                          }}
                        >
                          <span className="text-[9px] text-slate-500 dark:text-slate-400">
                            Blocked
                          </span>
                        </div>
                      );
                    })}

                  {/* Shift blocks */}
                  {!empTimeOff &&
                    empShifts.map((shift) => {
                      const pos = shiftToPosition(shift.startTime, shift.endTime);
                      const hours = calcHours(shift.startTime, shift.endTime);
                      const isConflict = conflictIds.has(shift.id);

                      return (
                        <Tooltip key={shift.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute left-1 right-1 rounded-md border px-2 py-1 cursor-pointer z-10 transition-all hover:shadow-md",
                                isConflict
                                  ? "bg-red-100 dark:bg-red-950/40 border-red-400 dark:border-red-700 ring-1 ring-red-400/50"
                                  : cn(palette.bg, palette.border),
                                shift.isRecurring && "border-dashed border-2"
                              )}
                              style={{
                                top: `${pos.top}%`,
                                height: `${Math.max(pos.height, 4)}%`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditShift(shift);
                              }}
                            >
                              <p
                                className={cn(
                                  "text-xs font-semibold truncate",
                                  isConflict
                                    ? "text-red-700 dark:text-red-300"
                                    : palette.text
                                )}
                              >
                                {shift.label}
                                {shift.isRecurring && " ↻"}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] truncate",
                                  isConflict
                                    ? "text-red-600 dark:text-red-400"
                                    : cn(palette.text, "opacity-75")
                                )}
                              >
                                {formatTime(shift.startTime)} – {formatTime(shift.endTime)} ({hours.toFixed(1)}h)
                              </p>
                              {isConflict && (
                                <p className="text-[9px] text-red-600 dark:text-red-400 font-medium mt-0.5">
                                  ⚠ Conflict
                                </p>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            <p className="font-semibold">{shift.label} Shift</p>
                            <p>
                              {formatTime(shift.startTime)} – {formatTime(shift.endTime)} ({hours.toFixed(1)}h)
                            </p>
                            {isConflict && (
                              <p className="text-red-500 font-medium">Overlapping shift detected</p>
                            )}
                            {shift.isRecurring && (
                              <p className="text-muted-foreground">Recurring weekly</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                  {/* Add shift button at bottom */}
                  {!empTimeOff && empAvail.every((r) => !r.allDay) && (
                    <div className="absolute bottom-2 left-1 right-1 z-20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-full border border-dashed border-transparent text-muted-foreground/40 hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddShift(emp.id, dayIndex);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EmployeeProfileDialog
        open={!!profileEmp}
        onOpenChange={(open) => { if (!open) setProfileEmp(null); }}
        employee={profileEmp}
        shifts={shifts}
        availability={availability}
        timeOff={timeOff}
        isOvertime={profileEmp ? overtimeEmpIds.has(profileEmp.id) : false}
        overtimeThreshold={40}
      />
    </div>
  );
}
