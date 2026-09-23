"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Briefcase,
  Building2,
  Clock,
  CalendarDays,
  AlertTriangle,
  Palmtree,
  Ban,
  Repeat,
  StickyNote,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, formatTime } from "@/lib/scheduling/constants";
import type {
  ScheduleEmployee,
  Shift,
  AvailabilityRule,
  TimeOffEntry,
} from "@/types/scheduling.types";

interface EmployeeProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: ScheduleEmployee | null;
  shifts: Shift[];
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  isOvertime: boolean;
  overtimeThreshold: number;
}

export function EmployeeProfileDialog({
  open,
  onOpenChange,
  employee,
  shifts,
  availability,
  timeOff,
  isOvertime,
  overtimeThreshold,
}: EmployeeProfileDialogProps) {
  if (!employee) return null;


  const empShifts = shifts.filter((s) => s.employeeId === employee.id);
  const totalHours = empShifts.reduce(
    (acc, s) => acc + s.durationMinutes / 60,
    0
  );
  const recurringCount = empShifts.filter((s) => s.isRecurring).length;

  const empAvailability = availability.filter((r) => r.employeeId === employee.id);
  const empTimeOff = timeOff.filter((t) => t.employeeId === employee.id);

  // Group shifts by day
  const shiftsByDay: Record<number, Shift[]> = {};
  for (const s of empShifts) {
    if (!shiftsByDay[s.dayIndex]) shiftsByDay[s.dayIndex] = [];
    shiftsByDay[s.dayIndex].push(s);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{employee.name}</DialogTitle>
          <DialogDescription>Employee profile and schedule summary</DialogDescription>
        </DialogHeader>

        {/* Profile header */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-7 w-7" />
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-lg font-semibold leading-tight">{employee.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs gap-1">
                <Briefcase className="h-3 w-3" />
                {employee.role}
              </Badge>
              <Badge variant="outline" className="text-xs gap-1">
                <Building2 className="h-3 w-3" />
                {employee.department}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Week stats */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div className="flex flex-col items-center gap-0.5">
            <div className={cn(
              "flex items-center gap-1 text-base font-bold",
              isOvertime && "text-amber-600 dark:text-amber-400"
            )}>
              {totalHours.toFixed(1)}h
              {isOvertime && <AlertTriangle className="h-3.5 w-3.5" />}
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {isOvertime ? `OT /${overtimeThreshold}h` : "Hours"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold">{empShifts.length}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Shifts
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold">{recurringCount}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Recurring
            </span>
          </div>
        </div>

        <Separator />

        {/* This week's schedule */}
        <div className="space-y-2 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            This Week
          </p>

          {empShifts.length === 0 && empTimeOff.length === 0 && empAvailability.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-2">
              No shifts scheduled this week
            </p>
          )}

          {/* Time-off entries */}
          {empTimeOff.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-md border border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 px-3 py-2"
            >
              <Palmtree className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                {t.label}
              </span>
              <span className="text-xs text-purple-500 dark:text-purple-400 ml-auto">
                {DAYS_OF_WEEK[t.dayIndex]}
              </span>
            </div>
          ))}

          {/* Availability blocks */}
          {empAvailability.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
            >
              <Ban className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {r.allDay
                  ? "Unavailable all day"
                  : `Unavailable ${formatTime(r.startTime!)} – ${formatTime(r.endTime!)}`}
              </span>
              <span className="text-xs text-slate-400 ml-auto">
                {DAYS_OF_WEEK[r.dayIndex]}
              </span>
            </div>
          ))}

          {/* Shifts per day */}
          {Object.keys(shiftsByDay)
            .map(Number)
            .sort((a, b) => a - b)
            .map((dayIdx) =>
              shiftsByDay[dayIdx].map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{s.label}</span>
                      {s.isRecurring && (
                        <Repeat className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTime(s.startTime)} – {formatTime(s.endTime)} · {(s.durationMinutes / 60).toFixed(1)}h
                    </span>
                    {s.note && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 italic truncate">
                          {s.note}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <CalendarDays className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {DAYS_OF_WEEK[dayIdx]}
                    </span>
                  </div>
                </div>
              ))
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
