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
import {
  MATCH_TOLERANCE_MINUTES,
  formatTime,
} from "@/lib/scheduling/constants";
import { formatDurationDelta, workedAsPlanned } from "@/lib/scheduling/utils";
import {
  SHIFT_ACCENT,
  SHIFT_CARD_SURFACE,
  SHIFT_RAIL_BASE,
} from "@/lib/scheduling/accents";
import {
  PENDING_CARD_CLASS,
  ShiftPendingOverlay,
} from "./shift-pending";
import {
  ShiftTooltipBody,
  ShiftTooltipHeader,
  ShiftTooltipHint,
  ShiftTooltipRow,
  ShiftTooltipStatus,
} from "./shift-tooltip";
import type { Shift, ActualShift } from "@/types/scheduling.types";

interface ActualShiftCardProps {
  /** The planned shift this cell represents. Undefined for standalone "added" coverage. */
  plannedShift?: Shift;
  /** The linked (or standalone) actual entry, if the shift has been reviewed. */
  actual?: ActualShift;
  onConfirm: (plannedShift: Shift) => void;
  onEdit: (plannedShift: Shift | undefined, actual: ActualShift | undefined) => void;
  onDelete: (actual: ActualShift) => void;
  /**
   * Accept a punch as reviewed without changing anything about it.
   *
   * The only way to review used to be opening the edit dialog — the tooltip
   * literally said so. That is a dialog round-trip to say "yes, that's fine".
   */
  onMarkReviewed?: (actual: ActualShift) => void;
  /** An action on this record is in flight. */
  isPending?: boolean;
}

export function ActualShiftCard({
  plannedShift,
  actual,
  onConfirm,
  onEdit,
  onDelete,
  onMarkReviewed,
  isPending,
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
              isPending && PENDING_CARD_CLASS,
            )}
          >
            {isPending && <ShiftPendingOverlay />}
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
              isPending && PENDING_CARD_CLASS,
            )}
          >
            {isPending && <ShiftPendingOverlay />}
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
  const isAdded = actual.status === "added";
  /**
   * The server's `status` flags ANY difference from the plan, down to the
   * minute — a punch two minutes early reads exactly like one two hours off.
   * Compare already applies a tolerance on top of that signal so a time clock's
   * ordinary drift does not get treated as a discrepancy; this card had not,
   * so the identical shift disagreed between the two views. Same helper, same
   * ten minutes, so a shift is either worked-as-planned everywhere or nowhere.
   */
  const withinTolerance = !!plannedShift && workedAsPlanned(plannedShift, actual);
  const isModified = actual.status === "modified" && !withinTolerance;
  const delta = plannedShift
    ? formatDurationDelta(plannedShift.durationMinutes, actual.durationMinutes)
    : null;
  /**
   * Nobody has looked at this yet.
   *
   * `status` cannot say this — an unreviewed punch and a manager-confirmed one
   * both read as `confirmed`. It matters most for a punch with NO planned shift
   * behind it, which otherwise renders as settled coverage even though it is
   * untouched. Undefined on responses predating the field, so this simply does
   * not fire there.
   */
  const needsReview = actual.reviewState === "unreviewed";
  /**
   * "Worked as planned" is the expected outcome, so it gets no rail at all.
   * Only a change (attention) or unplanned cover (info) is worth marking —
   * and anything still unreviewed outranks both.
   */
  const tone = needsReview
    ? "attention"
    : isModified
      ? "attention"
      : isAdded
        ? "info"
        // Reviewed and matching the plan: the one outcome worth confirming at a
        // glance, and previously indistinguishable from an empty cell.
        : "success";
  const accent = SHIFT_ACCENT[tone];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative px-2 py-1.5 text-xs cursor-pointer transition-all overflow-hidden",
            SHIFT_CARD_SURFACE,
            isPending && PENDING_CARD_CLASS,
          )}
        >
          {isPending && <ShiftPendingOverlay />}

          {/* Every reviewed outcome now has a tone, success included. */}
          <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />

          <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/*
              "Looks right" — one call, no dialog. Only on something nobody has
              looked at yet; a reviewed record has nothing left to accept.
            */}
            {needsReview && onMarkReviewed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-white/20"
                aria-label="Mark as reviewed"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkReviewed(actual);
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
              aria-label="Edit recorded time"
              onClick={() => onEdit(plannedShift, actual)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-rose-400 hover:text-rose-300 hover:bg-white/20"
              aria-label="Delete recorded time"
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

          {/*
            Times stay in the default foreground, as they do on the comparison
            card — colour rides on the rail, the icon and the status line. A
            tinted time reads as though the TIME were the problem, when what is
            being flagged is the shift's state.
          */}
          <div className="flex items-center gap-1 font-semibold leading-tight text-foreground">
            {isModified ? (
              <Pencil className={cn("h-3 w-3 shrink-0", accent.text)} />
            ) : isAdded ? (
              <UserPlus className={cn("h-3 w-3 shrink-0", accent.text)} />
            ) : (
              <Check className={cn("h-3 w-3 shrink-0", accent.text)} />
            )}
            <span className="truncate">
              {formatTime(actual.startTime)} - {formatTime(actual.endTime)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 truncate text-[10px] leading-tight opacity-75",
              // Bottom-right note icon floats over this row when present.
              actual.note && "pe-4",
              accent.text,
            )}
          >
            <span className="truncate">
              {needsReview
                ? "Needs review"
                : isAdded
                  ? "Added coverage"
                  : isModified
                    ? "Time changed"
                    : "Worked as planned"}
            </span>
            {/*
              Where this record came from. A clock-in is evidence; a manual
              entry is somebody's recollection typed in later, and until now the
              grid showed them identically — `source` was fetched and adapted
              but never rendered anywhere.
            */}
            {actual.source === "timeclock" && (
              <span
                aria-label="Recorded by the time clock"
                className="shrink-0 rounded-sm border border-current px-0.5 text-[8px] font-bold leading-[1.4] tracking-tight"
              >
                C
              </span>
            )}
          </p>

          {/*
            Shown for a match too, not only for a discrepancy — see Compare's
            note on the same line. Without it, a shift eight minutes over reads
            identically to one worked to the minute, and the row's own hours
            total stops looking like it agrees with the card.
          */}
          {delta && !needsReview && (
            <p
              className={cn(
                "mt-0.5 text-end text-[9px] font-semibold tabular-nums leading-none",
                accent.text,
              )}
            >
              {delta}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <ShiftTooltipHeader
          time={`${formatTime(actual.startTime)} – ${formatTime(actual.endTime)}`}
          hours={hours}
        />
        <ShiftTooltipStatus tone={tone}>
          {needsReview
            ? "Needs review"
            : isAdded
              ? "Worked without being planned"
              : isModified
                ? "Time changed"
                : "Worked as planned"}
        </ShiftTooltipStatus>

        <ShiftTooltipBody>
          <ShiftTooltipRow label="Source">
            {actual.source === "timeclock" ? "Time clock" : "Entered by hand"}
          </ShiftTooltipRow>
          <ShiftTooltipRow label="Plan">
            {plannedShift
              ? `${formatTime(plannedShift.startTime)} – ${formatTime(plannedShift.endTime)}`
              : "Not planned"}
          </ShiftTooltipRow>
          {delta && (
            <ShiftTooltipRow label="Against">{delta} the plan</ShiftTooltipRow>
          )}
          {actual.label && (
            <ShiftTooltipRow label="Label">{actual.label}</ShiftTooltipRow>
          )}
          {actual.note && (
            <ShiftTooltipRow label="Note">{actual.note}</ShiftTooltipRow>
          )}
        </ShiftTooltipBody>

        {needsReview && (
          <ShiftTooltipHint>
            Tick to accept it, or edit to correct the times.
          </ShiftTooltipHint>
        )}

        {!needsReview && withinTolerance && delta && (
          <ShiftTooltipHint>
            Within {MATCH_TOLERANCE_MINUTES} minutes of the plan, so it counts
            as worked as planned.
          </ShiftTooltipHint>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
