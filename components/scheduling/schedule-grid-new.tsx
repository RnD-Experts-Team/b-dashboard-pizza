"use client";

import { useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EMPLOYEE_COLORS, calcHours, formatTime } from "@/lib/scheduling/constants";
import { todayIndexIn } from "@/lib/scheduling/week";
import { EmployeeSyncBadge } from "./employee-sync-notice";
import { DraftShiftCard } from "./draft-shift-card";
import type { DraftShift } from "@/lib/scheduling/draft.store";

/** Stable empty array — a fresh `[]` each render would invalidate the memos. */
const NO_DRAFTS: DraftShift[] = [];
import {
  actualForPlanned,
  hasTimeOff,
  isBlockedByAvailability,
} from "@/lib/scheduling/utils";
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
  /** Unsaved shifts, rendered alongside the saved ones in planned mode. */
  draftShifts?: DraftShift[];
  onEditDraft?: (draft: DraftShift) => void;
  onDeleteDraft?: (draftId: string) => void;
}

/**
 * The compact day-state pill: time off, all-day unavailable, or a partial block.
 *
 * All three were previously styled differently — two tall bordered boxes with
 * centred icons, and one small one-line pill for partial blocks. Size ended up
 * carrying meaning it was never meant to: a fully blocked day looked far more
 * serious than a partially blocked one purely because its box was bigger, and
 * the two tall boxes ate most of a cell that also has to hold shift cards. They
 * are the same class of information, so they now share one shape and differ only
 * by colour and wording, with the detail moved into the tooltip.
 */
function DayBlockPill({
  tone,
  label,
  title,
  detail,
}: {
  tone: "leave" | "blocked";
  label: string;
  title: string;
  detail?: string | null;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded px-1 py-0.5 text-center",
            tone === "leave"
              ? "bg-purple-100 dark:bg-purple-900/30"
              : "bg-slate-100 dark:bg-slate-800/30",
          )}
        >
          <p
            className={cn(
              "truncate text-[9px] font-medium leading-tight",
              tone === "leave"
                ? "text-purple-600 dark:text-purple-300"
                : "text-slate-400",
            )}
          >
            {label}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{title}</p>
        {detail && <p>{detail}</p>}
      </TooltipContent>
    </Tooltip>
  );
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
  draftShifts = [],
  onEditDraft,
  onDeleteDraft,
}: ScheduleGridProps) {
  const [profileEmp, setProfileEmp] = useState<ScheduleEmployee | null>(null);
  const isActualMode = scheduleMode === "actual" && !comparisonMode;
  const effectiveShifts = displayShifts ?? shifts;

  /**
   * Drafts are a PLANNED-schedule concept: they are unsaved additions to the
   * plan and they save through the bulk create-shifts endpoint, which only
   * creates planned shifts. They mean nothing in Actual (what really happened)
   * or Compare (plan against reality).
   *
   * Gated once here rather than at each consumer. The previous shape gated the
   * cards but not the three totals, so Actual mode drew no draft cards while
   * still counting them in the Hours column and Daily Totals — and disagreeing
   * with the summary cards above the grid, which did exclude them.
   */
  const isPlannedMode = !isActualMode && !comparisonMode;
  const effectiveDrafts = isPlannedMode ? draftShifts : NO_DRAFTS;

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

  // Group drafts by employee + day, same key shape as shiftMap
  const draftMap = useMemo(() => {
    const map: Record<string, DraftShift[]> = {};
    for (const d of effectiveDrafts) {
      const key = `${d.employeeId}-${d.dayIndex}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [effectiveDrafts]);

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

  /**
   * Drafts are counted in every total below.
   *
   * The summary cards above the grid already include them, so leaving them out
   * here would make the Hours column and the Daily Totals row disagree with the
   * headline figures — which reads as a bug rather than a distinction. Draft
   * hours come from `calcHours` because an unsaved shift has no server-computed
   * duration yet, and nothing payroll-facing depends on them until it is saved.
   */
  // Per-employee weekly hours
  const hoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of effectiveShifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + s.durationMinutes / 60;
    }
    for (const d of effectiveDrafts) {
      map[d.employeeId] =
        (map[d.employeeId] ?? 0) + calcHours(d.startTime, d.endTime);
    }
    return map;
  }, [effectiveShifts, effectiveDrafts]);

  // Per-employee shift counts
  const shiftCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of effectiveShifts) {
      map[s.employeeId] = (map[s.employeeId] ?? 0) + 1;
    }
    for (const d of effectiveDrafts) {
      map[d.employeeId] = (map[d.employeeId] ?? 0) + 1;
    }
    return map;
  }, [effectiveShifts, effectiveDrafts]);

  // Today highlight — fullDates are ISO strings, so this is a plain lookup
  const todayIndex = useMemo(() => todayIndexIn(week), [week]);

  // Per-day totals
  const dayTotals = useMemo(() => {
    const totals: { hours: number; shifts: number }[] = Array.from({ length: 7 }, () => ({
      hours: 0,
      shifts: 0,
    }));
    for (const d of effectiveDrafts) {
      if (d.dayIndex >= 0 && d.dayIndex < 7) {
        totals[d.dayIndex].hours += calcHours(d.startTime, d.endTime);
        totals[d.dayIndex].shifts += 1;
      }
    }
    for (const s of effectiveShifts) {
      if (s.dayIndex >= 0 && s.dayIndex < 7) {
        totals[s.dayIndex].hours += s.durationMinutes / 60;
        totals[s.dayIndex].shifts += 1;
      }
    }
    return totals;
  }, [effectiveShifts, effectiveDrafts]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Horizontal scroll wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-200 sm:min-w-225 border-collapse">
          {/* Header row */}
          <thead>
            <tr className="border-b bg-muted/30">
              {/* Employee column header */}
              <th className="relative md:sticky left-0 z-20 bg-card w-31 min-w-31 sm:w-55 sm:min-w-55 border-r px-2 sm:px-3 py-2 sm:py-2.5 text-left">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-muted/30"
                />
                <span className="relative text-[9px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Employee
                </span>
              </th>

              {/* Day columns */}
              {week.dayNamesShort.map((day, i) => (
                <th
                  key={day}
                  className={cn(
                    comparisonMode
                      ? "min-w-32 sm:min-w-40"
                      : "min-w-32 sm:min-w-32.5",
                    "border-r last:border-r-0 px-1 sm:px-2 py-1.5 sm:py-2.5 text-center",
                    todayIndex === i && "bg-primary/5"
                  )}
                >
                  <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {day}
                  </p>
                  <p
                    className={cn(
                      "text-sm sm:text-lg font-bold leading-tight mt-0.5",
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
              <th className="w-14 min-w-14 sm:w-20 sm:min-w-20 px-1 sm:px-2 py-2 sm:py-2.5 text-center">
                <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                  <td className="md:sticky left-0 z-10 bg-card border-r px-2 sm:px-3 py-1.5 sm:py-2">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-[9px] sm:text-xs font-semibold",
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
                            className="text-[11px] sm:text-sm font-medium leading-tight truncate text-left hover:underline hover:text-primary transition-colors cursor-pointer"
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
                        <p className="text-[9px] sm:text-[11px] text-muted-foreground truncate">
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
                    const cellDrafts = draftMap[key] ?? [];
                    const empTimeOff = timeOff.find(
                      (t) => t.employeeId === emp.id && t.dayIndex === dayIdx
                    );
                    const empUnavailable = availability.filter(
                      (r) => r.employeeId === emp.id && r.dayIndex === dayIdx
                    );
                    const isFullDayBlocked =
                      !!empTimeOff || empUnavailable.some((r) => r.allDay);

                    /**
                     * Why a specific shift clashes, or null.
                     *
                     * Computed PER SHIFT rather than per cell so a partial block
                     * ("not before 17:00") only marks the shifts that actually
                     * overlap it, instead of every card in the day.
                     */
                    const blockReasonFor = (
                      startTime: string,
                      endTime: string,
                    ): string | null => {
                      if (employeeView) return null;
                      const off = hasTimeOff(emp.id, dayIdx, timeOff);
                      if (off) return `${emp.name} is on ${off.label} this day`;
                      const rule = isBlockedByAvailability(
                        emp.id,
                        dayIdx,
                        startTime,
                        endTime,
                        availability,
                      );
                      if (!rule) return null;
                      return rule.reason
                        ? `${emp.name} is unavailable: ${rule.reason}`
                        : `${emp.name} is marked unavailable at this time`;
                    };

                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          "border-r last:border-r-0 px-1 sm:px-1.5 py-1 sm:py-1.5 align-top min-h-15",
                          todayIndex === dayIdx && "bg-primary/2",
                          isFullDayBlocked && "bg-slate-100/60 dark:bg-slate-900/20"
                        )}
                      >
                        <div className="flex flex-col gap-0.5 sm:gap-1 min-h-13">
                          {/* Day state — one shape for all three, see DayBlockPill */}
                          {empTimeOff && !employeeView && (
                            <DayBlockPill
                              tone="leave"
                              label={empTimeOff.label}
                              title={empTimeOff.label}
                              detail={`${emp.name} is off this day`}
                            />
                          )}

                          {!empTimeOff &&
                            !employeeView &&
                            empUnavailable.some((r) => r.allDay) && (
                              <DayBlockPill
                                tone="blocked"
                                label="Unavailable"
                                title="Unavailable all day"
                                detail={
                                  empUnavailable.find((r) => r.allDay)?.reason ||
                                  `${emp.name} is marked unavailable this day`
                                }
                              />
                            )}

                          {!empTimeOff &&
                            !employeeView &&
                            !empUnavailable.some((r) => r.allDay) &&
                            empUnavailable.length > 0 && (
                              <DayBlockPill
                                tone="blocked"
                                label="Partial block"
                                title="Partially unavailable"
                                detail={empUnavailable
                                  .map((r) =>
                                    [
                                      r.startTime && r.endTime
                                        ? `${formatTime(r.startTime)} – ${formatTime(r.endTime)}`
                                        : null,
                                      r.reason || null,
                                    ]
                                      .filter(Boolean)
                                      .join(" — "),
                                  )
                                  .filter(Boolean)
                                  .join("; ")}
                              />
                            )}

                          {/* Comparison mode — side-by-side planned/actual diff, ignores day-block gating */}
                          {comparisonMode && (
                            <>
                              {cellShifts.map((shift) => (
                                <ComparisonShiftCard
                                  key={shift.id}
                                  plannedShift={shift}
                                  actual={actualForPlanned(shift.id, actualShifts)}
                                />
                              ))}
                              {cellAddedActuals.map((a) => (
                                <ComparisonShiftCard key={a.id} actual={a} />
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
                              {cellShifts.map((shift) => (
                                <ShiftCard
                                  key={shift.id}
                                  shift={shift}
                                  color={emp.color}
                                  hasConflict={conflictIds.has(shift.id)}
                                  blockedReason={blockReasonFor(
                                    shift.startTime,
                                    shift.endTime,
                                  )}
                                  onEdit={onEditShift}
                                  onDelete={onDeleteShift}
                                />
                              ))}

                              {/*
                                Drafts render after the saved cards. Gated on
                                employeeView because that flag is what strips
                                manager-only chrome for the publish/screenshot
                                capture — unsaved shifts must never reach the
                                PNG that gets posted in store.
                              */}
                              {!employeeView &&
                                cellDrafts.map((draft) => (
                                  <DraftShiftCard
                                    key={draft.draftId}
                                    draft={draft}
                                    color={emp.color}
                                    blockedReason={blockReasonFor(
                                      draft.startTime,
                                      draft.endTime,
                                    )}
                                    onEdit={(d) => onEditDraft?.(d)}
                                    onDelete={(id) => onDeleteDraft?.(id)}
                                  />
                                ))}

                              {/*
                                Add shift button.
                                Deliberately NOT hidden on a blocked day: a
                                manager must be able to schedule over a block
                                when they know why (someone agreed to cover).
                                The tooltip warns, the add dialog warns again
                                with the reason, and the resulting card is
                                marked — but nothing here refuses.
                              */}
                              {!employeeView && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block w-full">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={!emp.synced}
                                      className={cn(
                                        "h-6 w-full border border-dashed border-transparent text-muted-foreground/40",
                                        isFullDayBlocked
                                          ? "hover:border-amber-400/50 hover:text-amber-600 hover:bg-amber-500/5"
                                          : "hover:border-primary/30 hover:text-primary hover:bg-primary/5",
                                        "transition-all",
                                        cellShifts.length === 0 &&
                                          cellDrafts.length === 0 &&
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
                                    {!emp.synced ? (
                                      `${emp.name} is still being set up and can't be scheduled yet`
                                    ) : isFullDayBlocked ? (
                                      <>
                                        <p className="font-medium text-amber-600 dark:text-amber-400">
                                          {empTimeOff
                                            ? `${emp.name} is on ${empTimeOff.label} this day`
                                            : `${emp.name} is marked unavailable this day`}
                                        </p>
                                        <p className="opacity-80">
                                          You can still schedule over it.
                                        </p>
                                      </>
                                    ) : (
                                      `Add shift for ${emp.name}`
                                    )}
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
              <td className="relative md:sticky left-0 z-10 bg-card border-r px-2 sm:px-3 py-2">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-muted/20"
                />
                <span className="relative text-[10px] sm:text-xs font-semibold text-muted-foreground">
                  Daily Totals
                </span>
              </td>
              {week.dayNamesShort.map((_, i) => (
                <td
                  key={i}
                  className={cn(
                    "border-r last:border-r-0 px-1 sm:px-2 py-2 text-center",
                    todayIndex === i && "bg-primary/5"
                  )}
                >
                  <p className="text-[11px] sm:text-xs font-semibold">
                    {dayTotals[i].hours > 0
                      ? `${dayTotals[i].hours.toFixed(1)}h`
                      : "—"}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                    {dayTotals[i].shifts > 0
                      ? `${dayTotals[i].shifts} shift${dayTotals[i].shifts > 1 ? "s" : ""}`
                      : ""}
                  </p>
                </td>
              ))}
              <td className="px-1 sm:px-2 py-2 text-center">
                <p className="text-[11px] sm:text-xs font-bold">
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
