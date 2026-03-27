"use client";

import { Clock, Pencil, Trash2, AlertTriangle, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime, calcHours, EMPLOYEE_COLORS } from "@/lib/scheduling/data";
import type { Shift } from "@/types/scheduling.types";

interface ShiftCardProps {
  shift: Shift;
  color: string;
  hasConflict?: boolean;
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}

export function ShiftCard({ shift, color, hasConflict, onEdit, onDelete }: ShiftCardProps) {
  const palette = EMPLOYEE_COLORS[color] ?? EMPLOYEE_COLORS.blue;
  const hours = calcHours(shift.startTime, shift.endTime);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden",
            hasConflict
              ? "bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-700 ring-1 ring-red-400/40"
              : cn(palette.bg, palette.border),
            shift.isRecurring && "border-dashed border-2"
          )}
          onClick={() => onEdit(shift)}
        >
          {/* Dark overlay + centered actions on hover */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shift);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-rose-400 hover:text-rose-300 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shift.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Conflict indicator */}
          {hasConflict && (
            <div className="absolute top-0.5 right-0.5 z-5">
              <AlertTriangle className="h-3 w-3 text-red-500" />
            </div>
          )}

          {/* Recurring indicator */}
          {shift.isRecurring && (
            <div className={cn("absolute top-0.5 z-5", hasConflict ? "right-4" : "right-0.5")}>
              <Repeat className="h-2.5 w-2.5 text-indigo-500 dark:text-indigo-400" />
            </div>
          )}

          {/* Time range */}
          <div className={cn(
            "flex items-center gap-1 font-semibold leading-tight",
            hasConflict ? "text-red-700 dark:text-red-300" : palette.text
          )}>
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
            </span>
          </div>

          {/* Label */}
          <p className={cn(
            "mt-0.5 text-[10px] leading-tight opacity-75",
            hasConflict ? "text-red-600 dark:text-red-400" : palette.text
          )}>
            {shift.label}
            {shift.isRecurring && " ↻"}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{shift.label} Shift</p>
        <p>
          {formatTime(shift.startTime)} – {formatTime(shift.endTime)} ({hours.toFixed(1)}h)
        </p>
        {hasConflict && (
          <p className="text-red-500 font-medium">⚠ Overlapping shift conflict</p>
        )}
        {shift.isRecurring && (
          <p className="text-indigo-500">↻ Recurring weekly</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
