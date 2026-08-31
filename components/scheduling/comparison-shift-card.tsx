"use client";

import { AlertTriangle, Check, UserX, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EMPLOYEE_COLORS, formatTime } from "@/lib/scheduling/constants";
import type { Shift, ActualShift } from "@/types/scheduling.types";

interface ComparisonShiftCardProps {
  /** The planned shift this cell represents. Undefined for standalone "added" coverage. */
  plannedShift?: Shift;
  /** The linked (or standalone) actual entry, if reviewed. */
  actual?: ActualShift;
  color: string;
}

export function ComparisonShiftCard({ plannedShift, actual, color }: ComparisonShiftCardProps) {
  const palette = EMPLOYEE_COLORS[color] ?? EMPLOYEE_COLORS.blue;

  // Standalone ad-hoc coverage — no planned reference to compare against
  if (!plannedShift && actual?.status === "added") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-md border border-sky-400 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/30 px-2 py-1.5 text-xs">
            <div className="flex items-center gap-1 font-semibold leading-tight text-sky-700 dark:text-sky-300">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-tight text-sky-600 dark:text-sky-400">
              Added coverage
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">Added coverage</p>
          <p>Not in the original plan</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!plannedShift) return null;

  // Still pending review — nothing to compare yet
  if (!actual) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative rounded-md border border-dashed px-2 py-1.5 text-xs opacity-60", palette.border)}>
            <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
            <div className={cn("flex items-center gap-1 font-semibold leading-tight", palette.text)}>
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatTime(plannedShift.startTime)} - {formatTime(plannedShift.endTime)}
              </span>
            </div>
            <p className={cn("mt-0.5 text-[10px] leading-tight opacity-75", palette.text)}>
              Pending review
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">Not yet reviewed</p>
          <p>No actual attendance recorded for this shift</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Absent — planned struck through, red no-show badge, warning
  if (actual.status === "absent") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative rounded-md border border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-2 py-1.5 text-xs">
            <div className="absolute top-0.5 right-0.5">
              <AlertTriangle className="h-3 w-3 text-red-500" />
            </div>
            <p className="text-[10px] leading-tight text-red-500 dark:text-red-400 line-through">
              Planned {formatTime(plannedShift.startTime)}–{formatTime(plannedShift.endTime)}
            </p>
            <div className="mt-0.5 flex items-center gap-1 font-semibold leading-tight text-red-700 dark:text-red-300">
              <UserX className="h-3 w-3 shrink-0" />
              <span className="truncate">No Show</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold text-red-500">⚠ No attendance — planned but did not work</p>
          <p>
            Planned: {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const timesMatch =
    plannedShift.startTime === actual.startTime && plannedShift.endTime === actual.endTime;

  // Matches — compact single card, small check, no need to duplicate the time
  if (timesMatch) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative rounded-md border px-2 py-1.5 text-xs", palette.bg, palette.border)}>
            <div className="absolute top-0.5 right-0.5">
              <Check className="h-3 w-3 text-emerald-500" />
            </div>
            <div className={cn("flex items-center gap-1 font-semibold leading-tight", palette.text)}>
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
              </span>
            </div>
            <p className={cn("mt-0.5 text-[10px] leading-tight opacity-75", palette.text)}>
              Matches plan
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold text-emerald-600">✓ Worked as planned</p>
          <p>
            {formatTime(actual.startTime)} – {formatTime(actual.endTime)}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Differ (modified) — stacked planned/actual with warning triangle
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative rounded-md border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-xs">
          <div className="absolute top-0.5 right-0.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">
            Planned {formatTime(plannedShift.startTime)}–{formatTime(plannedShift.endTime)}
          </p>
          <div className="mt-0.5 flex items-center gap-1 font-semibold leading-tight text-amber-700 dark:text-amber-300">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold text-amber-500">⚠ Actual time differs from plan</p>
        <p>
          Planned: {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)}
        </p>
        <p>
          Actual: {formatTime(actual.startTime)} – {formatTime(actual.endTime)}
        </p>
        {actual.note && <p className="text-amber-600 dark:text-amber-400 italic">📝 {actual.note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
