"use client";

import { Check, Pencil, Trash2, UserX, Clock, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EMPLOYEE_COLORS, formatTime } from "@/lib/scheduling/constants";
import type { Shift, ActualShift } from "@/types/scheduling.types";

interface ActualShiftCardProps {
  /** The planned shift this cell represents. Undefined for standalone "added" coverage. */
  plannedShift?: Shift;
  /** The linked (or standalone) actual entry, if the shift has been reviewed. */
  actual?: ActualShift;
  color: string;
  onConfirm: (plannedShift: Shift) => void;
  onEdit: (plannedShift: Shift | undefined, actual: ActualShift | undefined) => void;
  onDelete: (actual: ActualShift) => void;
}

export function ActualShiftCard({
  plannedShift,
  actual,
  color,
  onConfirm,
  onEdit,
  onDelete,
}: ActualShiftCardProps) {
  const palette = EMPLOYEE_COLORS[color] ?? EMPLOYEE_COLORS.blue;

  // Ghost / pending — planned shift not yet reviewed
  if (!actual) {
    if (!plannedShift) return null;
    const hours = plannedShift.durationMinutes / 60;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group relative rounded-md border border-dashed px-2 py-1.5 text-xs opacity-60 transition-all overflow-hidden",
              palette.border
            )}
          >
            <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-white/20"
                onClick={() => onConfirm(plannedShift)}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
                onClick={() => onEdit(plannedShift, undefined)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className={cn("flex items-center gap-1 font-semibold leading-tight", palette.text)}>
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatTime(plannedShift.startTime)} - {formatTime(plannedShift.endTime)}
              </span>
            </div>
            <p className={cn("mt-0.5 text-[10px] leading-tight opacity-75", palette.text)}>
              {plannedShift.label} · Pending review
            </p>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">Planned — not yet reviewed</p>
          <p>
            {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)} ({hours.toFixed(1)}h)
          </p>
          <p className="text-muted-foreground">Click ✓ to confirm, or the pencil to edit</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Absent — no-show marker
  if (actual.status === "absent") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group relative rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
                onClick={() => onEdit(plannedShift, actual)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-rose-400 hover:text-rose-300 hover:bg-white/20"
                onClick={() => onDelete(actual)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-1 font-semibold leading-tight text-red-700 dark:text-red-300">
              <UserX className="h-3 w-3 shrink-0" />
              <span className="truncate">No Show</span>
            </div>
            {plannedShift && (
              <p className="mt-0.5 text-[10px] leading-tight text-red-600 dark:text-red-400 line-through opacity-75">
                {formatTime(plannedShift.startTime)} - {formatTime(plannedShift.endTime)}
              </p>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">No attendance recorded</p>
          {plannedShift && (
            <p>
              Planned: {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)}
            </p>
          )}
          {actual.note && <p className="text-amber-600 dark:text-amber-400 italic">📝 {actual.note}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Confirmed / modified / added — solid worked-shift card
  const hours = actual.durationMinutes / 60;
  const isModified = actual.status === "modified";
  const isAdded = actual.status === "added";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden",
            isModified
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700"
              : isAdded
                ? "bg-sky-50 dark:bg-sky-950/30 border-sky-400 dark:border-sky-700"
                : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700"
          )}
        >
          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
              onClick={() => onEdit(plannedShift, actual)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-rose-400 hover:text-rose-300 hover:bg-white/20"
              onClick={() => onDelete(actual)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {actual.note && (
            <div className="absolute bottom-0.5 right-0.5 z-5">
              <StickyNote className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-1 font-semibold leading-tight",
              isModified
                ? "text-amber-700 dark:text-amber-300"
                : isAdded
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-emerald-700 dark:text-emerald-300"
            )}
          >
            {isModified ? (
              <Pencil className="h-3 w-3 shrink-0" />
            ) : isAdded ? (
              <UserX className="h-3 w-3 shrink-0 rotate-180" />
            ) : (
              <Check className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 text-[10px] leading-tight opacity-75",
              isModified
                ? "text-amber-600 dark:text-amber-400"
                : isAdded
                  ? "text-sky-600 dark:text-sky-400"
                  : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {isAdded ? "Added coverage" : isModified ? "Time changed" : "Worked as planned"}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{actual.label} Shift</p>
        <p>
          {formatTime(actual.startTime)} – {formatTime(actual.endTime)} ({hours.toFixed(1)}h)
        </p>
        {plannedShift && isModified && (
          <p className="text-amber-500">
            Planned: {formatTime(plannedShift.startTime)} – {formatTime(plannedShift.endTime)}
          </p>
        )}
        {isAdded && <p className="text-sky-500">Ad-hoc coverage — not in the original plan</p>}
        {actual.note && <p className="text-amber-600 dark:text-amber-400 italic">📝 {actual.note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
