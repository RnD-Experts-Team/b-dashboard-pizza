"use client";

import {
  Check,
  Pencil,
  Trash2,
  UserPlus,
  UserX,
  Clock,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import {
  SHIFT_ACCENT,
  SHIFT_CARD_SURFACE,
  SHIFT_RAIL_BASE,
} from "@/lib/scheduling/accents";
import type { Shift, ActualShift } from "@/types/scheduling.types";

interface ActualShiftCardProps {
  /** The planned shift this cell represents. Undefined for standalone "added" coverage. */
  plannedShift?: Shift;
  /** The linked (or standalone) actual entry, if the shift has been reviewed. */
  actual?: ActualShift;
  onConfirm: (plannedShift: Shift) => void;
  onEdit: (plannedShift: Shift | undefined, actual: ActualShift | undefined) => void;
  onDelete: (actual: ActualShift) => void;
}

export function ActualShiftCard({
  plannedShift,
  actual,
  onConfirm,
  onEdit,
  onDelete,
}: ActualShiftCardProps) {

  // Ghost / pending — planned shift not yet reviewed
  if (!actual) {
    if (!plannedShift) return null;
    const hours = plannedShift.durationMinutes / 60;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "group relative px-2 py-1.5 text-xs opacity-60 transition-all overflow-hidden",
              SHIFT_CARD_SURFACE,
              "border-dashed",
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

            <div className="flex items-center gap-1 font-semibold leading-tight text-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {formatTime(plannedShift.startTime)} - {formatTime(plannedShift.endTime)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
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
          <div
            className={cn(
              "group relative px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden",
              SHIFT_CARD_SURFACE,
            )}
          >
            <span
              aria-hidden
              className={cn(SHIFT_RAIL_BASE, SHIFT_ACCENT.critical.rail)}
            />
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

            <div
              className={cn(
                "flex items-center gap-1 font-semibold leading-tight",
                SHIFT_ACCENT.critical.text,
              )}
            >
              <UserX className="h-3 w-3 shrink-0" />
              <span className="truncate">No Show</span>
            </div>
            {plannedShift && (
              <p
                className={cn(
                  "mt-0.5 text-[10px] leading-tight line-through opacity-75",
                  SHIFT_ACCENT.critical.text,
                )}
              >
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
  /**
   * "Worked as planned" is the expected outcome, so it gets no rail at all.
   * Only a change (attention) or unplanned cover (info) is worth marking.
   */
  const tone = isModified ? "attention" : isAdded ? "info" : "neutral";
  const accent = SHIFT_ACCENT[tone];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden",
            SHIFT_CARD_SURFACE,
          )}
        >
          {tone !== "neutral" && (
            <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />
          )}

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
              tone === "neutral" ? "text-foreground" : accent.text,
            )}
          >
            {isModified ? (
              <Pencil className="h-3 w-3 shrink-0" />
            ) : isAdded ? (
              <UserPlus className="h-3 w-3 shrink-0" />
            ) : (
              <Check className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-[10px] leading-tight opacity-75",
              // Bottom-right note icon floats over this row when present.
              actual.note && "pe-4",
              tone === "neutral" ? "text-muted-foreground" : accent.text,
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
        {isAdded && (
          <p className={SHIFT_ACCENT.info.text}>
            Ad-hoc coverage — not in the original plan
          </p>
        )}
        {actual.note && <p className="text-amber-600 dark:text-amber-400 italic">📝 {actual.note}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
