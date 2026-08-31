"use client";

import { useMemo, useState } from "react";
import { Plus, Ban, Palmtree, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EMPLOYEE_COLORS } from "@/lib/scheduling/constants";
import { todayIndexIn } from "@/lib/scheduling/week";
import { EmployeeSyncBadge } from "./employee-sync-notice";
import { actualForPlanned } from "@/lib/scheduling/utils";
import { ShiftCard } from "./shift-card";
import { ActualShiftCard } from "./actual-shift-card";
import { ComparisonShiftCard } from "./comparison-shift-card";
import { EmployeeProfileDialog } from "./employee-profile-dialog";
import type {
  ScheduleEmployee,
  Shift,
  WeekInfo,
  AvailabilityRule,
  TimeOffEntry,
  ActualShift,
  ScheduleMode,
} from "@/types/scheduling.types";

interface ScheduleGridProps {
  employees: ScheduleEmployee[];
  shifts: Shift[];
  week: WeekInfo;
  conflictIds: Set<string>;
  overtimeEmpIds: Set<string>;
  overtimeThreshold: number;
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  onAddShift: (employeeId: string, dayIndex: number) => void;
  onEditShift: (shift: Shift) => void;
  onDeleteShift: (shiftId: string) => void;
  onEmployeeClick?: (employee: ScheduleEmployee) => void;
  /** When true, hides hours column, daily-totals row, time-off & availability blocks (employee-facing screenshot) */
  employeeView?: boolean;
  /** Planned vs actual toggle state — defaults to "planned" when omitted */
  scheduleMode?: ScheduleMode;
  /** When true, renders the side-by-side planned/actual diff view instead of scheduleMode */
  comparisonMode?: boolean;
  /** This week's actual-schedule entries */
  actualShifts?: ActualShift[];
  /** Reviewed-only merged shifts, used for hours/totals when not in pure planned mode */
  displayShifts?: Shift[];
  onConfirmActual?: (plannedShift: Shift) => void;
  onEditActual?: (plannedShift: Shift | undefined, actual: ActualShift | undefined) => void;
  onDeleteActual?: (actual: ActualShift) => void;
  onAddCoverage?: (employeeId: string, dayIndex: number) => void;
}

export function ScheduleGrid({
  employees,
  shifts,
  week,
  conflictIds,
  overtimeEmpIds,
  overtimeThreshold,
  availability,
  timeOff,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onEmployeeClick,
  employeeView,
  scheduleMode = "planned",
  comparisonMode = false,
  actualShifts = [],
  displayShifts,
  onConfirmActual,
  onEditActual,
  onDeleteActual,
  onAddCoverage,
}: ScheduleGridProps) {
  const [profileEmp, setProfileEmp] = useState<ScheduleEmployee | null>(null);
  const isActualMode = scheduleMode === "actual" && !comparisonMode;
  const effectiveShifts = displayShifts ?? shifts;

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

  // Group standalone "added" actual shifts (ad-hoc coverage) by employee + day
  const addedActualMap = useMemo(() => {
    const map: Record<string, ActualShift[]> = {};
    for (const a of actualShifts) {
      if (a.status !== "added" || a.plannedShiftId) continue;
      const key = `${a.employeeId}-${a.dayIndex}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [actualShifts]);

  // Per-employee weekly hours
  const hoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of effectiveShifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + s.durationMinutes / 60;
    }
    return map;
  }, [effectiveShifts]);

  // Per-employee shift counts
  const shiftCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of effectiveShifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + 1;
    }
    return map;
  }, [effectiveShifts]);

  // Today highlight — fullDates are ISO strings, so this is a plain lookup
  const todayIndex = useMemo(() => todayIndexIn(week), [week]);

  // Per-day totals
  const dayTotals = useMemo(() => {
    const totals: { hours: number; shifts: number }[] = Array.from({ length: 7 }, () => ({
      hours: 0,
      shifts: 0,
    }));
    for (const s of effectiveShifts) {
      if (s.dayIndex >= 0 && s.dayIndex < 7) {
        totals[s.dayIndex].hours += s.durationMinutes / 60;
        totals[s.dayIndex].shifts += 1;
      }
    }
    return totals;
  }, [effectiveShifts]);

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
              {week.dayNamesShort.map((day, i) => (
                <th
                  key={day}
                  className={cn(
                    comparisonMode ? "min-w-40" : "min-w-32.5",
                    "border-r last:border-r-0 px-2 py-2.5 text-center",
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
              {!employeeView && (
              <th className="w-20 min-w-20 px-2 py-2.5 text-center">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Hours
                </span>
              </th>
              )}
            </tr>
          </thead>

          {/* Employee rows */}
          <tbody>
            {employees.map((emp) => {
              const empHours = hoursMap[emp.id] ?? 0;
              const empShiftCount = shiftCountMap[emp.id] ?? 0;
              const palette = EMPLOYEE_COLORS[emp.color] ?? EMPLOYEE_COLORS.blue;
              const isOvertime = overtimeEmpIds.has(emp.id);

              return (
                <tr
                  key={emp.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/10 transition-colors",
                    isOvertime && "bg-amber-50/40 dark:bg-amber-950/10"
                  )}
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
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="text-sm font-medium leading-tight truncate text-left hover:underline hover:text-primary transition-colors cursor-pointer"
                            onClick={() => {
                              setProfileEmp(emp);
                              onEmployeeClick?.(emp);
                            }}
                          >
                            {emp.name}
                          </button>
                          {!emp.synced && <EmployeeSyncBadge className="shrink-0" />}
                          {isOvertime && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 cursor-default">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  OT
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {empHours.toFixed(1)}h this week — exceeds {overtimeThreshold}h threshold
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {emp.role}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {week.dayNamesShort.map((_, dayIdx) => {
                    const key = `${emp.id}-${dayIdx}`;
                    const cellShifts = shiftMap[key] ?? [];
                    const cellAddedActuals = addedActualMap[key] ?? [];
                    const empTimeOff = timeOff.find(
                      (t) => t.employeeId === emp.id && t.dayIndex === dayIdx
                    );
                    const empUnavailable = availability.filter(
                      (r) => r.employeeId === emp.id && r.dayIndex === dayIdx
                    );
                    const isFullDayBlocked =
                      !!empTimeOff || empUnavailable.some((r) => r.allDay);

                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          "border-r last:border-r-0 px-1.5 py-1.5 align-top min-h-15",
                          todayIndex === dayIdx && "bg-primary/2",
                          isFullDayBlocked && "bg-slate-100/60 dark:bg-slate-900/20"
                        )}
                      >
                        <div className="flex flex-col gap-1 min-h-13">
                          {/* Time-off block */}
                          {empTimeOff && !employeeView && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="rounded-md border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 px-2 py-2 text-center">
                                  <Palmtree className="h-3.5 w-3.5 mx-auto text-purple-500" />
                                  <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 mt-0.5">
                                    {empTimeOff.label}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">{empTimeOff.label}</p>
                                <p>{emp.name} is off this day</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Unavailable block (all-day only when no time-off) */}
                          {!empTimeOff && !employeeView && empUnavailable.some((r) => r.allDay) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40 px-2 py-2 text-center">
                                  <Ban className="h-3.5 w-3.5 mx-auto text-slate-400" />
                                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    Unavailable
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">Unavailable</p>
                                <p>{empUnavailable.find((r) => r.allDay)?.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Partial unavailability indicator (non-blocking) */}
                          {!empTimeOff && !employeeView && !empUnavailable.some((r) => r.allDay) && empUnavailable.length > 0 && (
                            <div className="rounded bg-slate-100 dark:bg-slate-800/30 px-1 py-0.5 text-center">
                              <p className="text-[9px] text-slate-400">
                                Partial block
                              </p>
                            </div>
                          )}

                          {/* Comparison mode — side-by-side planned/actual diff, ignores day-block gating */}
                          {comparisonMode && (
                            <>
                              {cellShifts.map((shift) => (
                                <ComparisonShiftCard
                                  key={shift.id}
                                  plannedShift={shift}
                                  actual={actualForPlanned(shift.id, actualShifts)}
                                  color={emp.color}
                                />
                              ))}
                              {cellAddedActuals.map((a) => (
                                <ComparisonShiftCard key={a.id} actual={a} color={emp.color} />
                              ))}
                            </>
                          )}

                          {/* Actual mode — ghost/confirmed/modified/absent cards + ad-hoc coverage */}
                          {isActualMode && (
                            <>
                              {cellShifts.map((shift) => (
                                <ActualShiftCard
                                  key={shift.id}
                                  plannedShift={shift}
                                  actual={actualForPlanned(shift.id, actualShifts)}
                                  color={emp.color}
                                  onConfirm={(s) => onConfirmActual?.(s)}
                                  onEdit={(s, a) => onEditActual?.(s, a)}
                                  onDelete={(a) => onDeleteActual?.(a)}
                                />
                              ))}
                              {cellAddedActuals.map((a) => (
                                <ActualShiftCard
                                  key={a.id}
                                  actual={a}
                                  color={emp.color}
                                  onConfirm={() => {}}
                                  onEdit={(s, act) => onEditActual?.(s, act)}
                                  onDelete={(act) => onDeleteActual?.(act)}
                                />
                              ))}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "h-6 w-full border border-dashed border-transparent text-muted-foreground/40",
                                      "hover:border-sky-400/40 hover:text-sky-600 hover:bg-sky-500/5",
                                      "transition-all",
                                      cellShifts.length === 0 &&
                                        cellAddedActuals.length === 0 &&
                                        "mt-2"
                                    )}
                                    onClick={() => onAddCoverage?.(emp.id, dayIdx)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Add coverage for {emp.name}
                                </TooltipContent>
                              </Tooltip>
                            </>
                          )}

                          {/* Planned mode (default) — unchanged existing behavior */}
                          {!comparisonMode && !isActualMode && (
                            <>
                              {(!isFullDayBlocked || employeeView) &&
                                cellShifts.map((shift) => (
                                  <ShiftCard
                                    key={shift.id}
                                    shift={shift}
                                    color={emp.color}
                                    hasConflict={conflictIds.has(shift.id)}
                                    onEdit={onEditShift}
                                    onDelete={onDeleteShift}
                                  />
                                ))}

                              {/* Add shift button (hidden when fully blocked or employee view) */}
                              {!isFullDayBlocked && !employeeView && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={!emp.synced}
                                      className={cn(
                                        "h-6 w-full border border-dashed border-transparent text-muted-foreground/40",
                                        "hover:border-primary/30 hover:text-primary hover:bg-primary/5",
                                        "transition-all",
                                        cellShifts.length === 0 &&
                                          !empUnavailable.length &&
                                          "mt-2"
                                      )}
                                      onClick={() => onAddShift(emp.id, dayIdx)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {emp.synced
                                      ? `Add shift for ${emp.name}`
                                      : `${emp.name} is still being set up and can't be scheduled yet`}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Hours total */}
                  {!employeeView && (
                  <td className={cn(
                    "px-2 py-2 text-center",
                    isOvertime && "bg-amber-50/60 dark:bg-amber-950/20"
                  )}>
                    <p className={cn(
                      "text-sm font-semibold",
                      isOvertime && "text-amber-700 dark:text-amber-300"
                    )}>
                      {empHours > 0 ? `${empHours.toFixed(1)}h` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {empShiftCount > 0 ? `${empShiftCount} shift${empShiftCount > 1 ? "s" : ""}` : ""}
                    </p>
                    {isOvertime && (
                      <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                        /{overtimeThreshold}h
                      </p>
                    )}
                  </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Footer totals row */}
          {!employeeView && (
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td className="sticky left-0 z-10 bg-muted/20 border-r px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Daily Totals
                </span>
              </td>
              {week.dayNamesShort.map((_, i) => (
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
                  {effectiveShifts.length > 0
                    ? `${effectiveShifts.reduce((t, s) => t + s.durationMinutes / 60, 0).toFixed(1)}h`
                    : "—"}
                </p>
              </td>
            </tr>
          </tfoot>
          )}
        </table>
      </div>

      <EmployeeProfileDialog
        open={!!profileEmp}
        onOpenChange={(open) => { if (!open) setProfileEmp(null); }}
        employee={profileEmp}
        shifts={shifts}
        availability={availability}
        timeOff={timeOff}
        isOvertime={profileEmp ? overtimeEmpIds.has(profileEmp.id) : false}
        overtimeThreshold={overtimeThreshold}
      />
    </div>
  );
}
