"use client";

import { Ban, Clock, Pencil, Trash2, AlertTriangle, Repeat, StickyNote } from "lucide-react";
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
  hasRail,
  type ShiftTone,
} from "@/lib/scheduling/accents";
import { formatIsoDateWithWeekday } from "@/lib/scheduling/week";
import type { Shift } from "@/types/scheduling.types";
import {
  ShiftOriginIndicator,
  ShiftSyncIndicator,
} from "./shift-sync-badge";

/**
 * Right-hand space reserved on the text rows for the absolutely-positioned
 * corner markers.
 *
 * `truncate` alone is not enough: it clips against the card's full width, which
 * knows nothing about the icons floating over it, so a long time range slides
 * underneath them. Indexed by how many markers that corner is actually showing,
 * so a card with no markers keeps its full width.
 *
 * Logical (`pe-`) rather than `pr-` because the markers sit at `right-0.5` via
 * `end`-agnostic positioning and the grid is rendered RTL for Arabic.
 */
const MARKER_RESERVE = ["", "pe-4", "pe-7", "pe-10"] as const;

interface ShiftCardProps {
  shift: Shift;
  hasConflict?: boolean;
  /**
   * Set when this shift falls inside blocked availability or approved leave.
   *
   * The grid used to HIDE these cards entirely, which hid the problem rather
   * than the card: the shift stayed scheduled, staff still saw it, and it kept
   * counting toward the hours column and daily totals — so the row read "3
   * shifts" while only two were drawn. A manager cannot fix a clash they cannot
   * see, so the card is shown and marked instead.
   */
  blockedReason?: string | null;
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}

export function ShiftCard({ shift, hasConflict, blockedReason, onEdit, onDelete }: ShiftCardProps) {
  const hours = shift.durationMinutes / 60;
  // An overlap is the louder problem, so it owns the rail; the block still gets
  // its own marker and tooltip line below.
  const isBlocked = !!blockedReason && !hasConflict;

  const tone: ShiftTone = hasConflict
    ? "critical"
    : isBlocked
      ? "attention"
      : "neutral";
  const accent = SHIFT_ACCENT[tone];

  const topMarkers =
    Number(!!hasConflict) + Number(isBlocked) + Number(!!shift.isRecurring);
  const bottomMarkers =
    Number(shift.syncStatus !== "synced") +
    Number(shift.origin !== "operations") +
    Number(!!shift.note);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative px-1.5 sm:px-2 py-1 sm:py-1.5 text-[10px] sm:text-xs cursor-pointer transition-all overflow-hidden",
            SHIFT_CARD_SURFACE,
            shift.isRecurring && "border-dashed",
            shift.syncStatus === "pending" && "opacity-90"
          )}
          onClick={() => onEdit(shift)}
        >
          {/* Status rail — drawn only when something needs attention. */}
          {hasRail(tone) && (
            <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />
          )}
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

          {/*
            Top-right markers. One flex cluster rather than individually
            positioned icons, so a third marker cannot collide with the other
            two the way a hardcoded `right-4` offset would.
          */}
          {(hasConflict || isBlocked || shift.isRecurring) && (
            <div className="absolute top-0.5 right-0.5 z-5 flex items-center gap-0.5">
              {hasConflict && (
                <AlertTriangle className={cn("h-3 w-3", accent.text)} />
              )}
              {isBlocked && <Ban className={cn("h-3 w-3", accent.text)} />}
              {shift.isRecurring && (
                <Repeat className="h-2.5 w-2.5 text-indigo-500 dark:text-indigo-400" />
              )}
            </div>
          )}

          {/*
            Status markers, bottom-right.
            Kept off the left edge on purpose: as the week grid scrolls, cards
            slide under the sticky employee column and lose their left side
            first, which would hide the sync state precisely when scrolled.
          */}
          {(shift.syncStatus !== "synced" ||
            shift.origin !== "operations" ||
            shift.note) && (
            <div className="absolute bottom-0.5 right-0.5 z-5 flex items-center gap-1">
              <ShiftSyncIndicator syncStatus={shift.syncStatus} />
              <ShiftOriginIndicator origin={shift.origin} />
              {shift.note && (
                <StickyNote className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
              )}
            </div>
          )}

          {/* Time range */}
          <div className={cn(
            "flex items-center gap-1 font-semibold leading-tight text-foreground",
            MARKER_RESERVE[topMarkers]
          )}>
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
            </span>
          </div>

          {/* Label */}
          <p className={cn(
            "mt-0.5 truncate text-[9px] sm:text-[10px] leading-tight text-muted-foreground",
            MARKER_RESERVE[bottomMarkers]
          )}>
            {shift.label}
            {shift.isRecurring && " ↻"}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{shift.label} Shift</p>
        <p className="opacity-80">{formatIsoDateWithWeekday(shift.shiftDate)}</p>
        <p>
          {formatTime(shift.startTime)} – {formatTime(shift.endTime)} ({hours.toFixed(1)}h)
        </p>
        {hasConflict && (
          <p className={cn("font-medium", accent.text)}>
            ⚠ Overlapping shift conflict
          </p>
        )}
        {blockedReason && (
          <p
            className={cn(
              "font-medium",
              hasConflict ? SHIFT_ACCENT.attention.text : accent.text,
            )}
          >
            ⚠ {blockedReason}
          </p>
        )}
        {shift.isRecurring && (
          <p className="text-indigo-500">↻ Recurring weekly</p>
        )}
        {shift.syncStatus === "pending" && (
          <p className="text-sky-500">Saved — waiting to reach Humanity</p>
        )}
        {shift.syncStatus === "parked" && (
          <p className="font-medium text-rose-500">
            Saved here, but not in Humanity — needs attention
          </p>
        )}
        {shift.origin !== "operations" && (
          <p className="text-muted-foreground">Last changed in Humanity</p>
        )}
        {shift.note && (
          <p className="text-amber-600 dark:text-amber-400 italic">📝 {shift.note}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
