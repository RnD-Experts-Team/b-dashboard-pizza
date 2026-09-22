"use client";

import {
  Check,
  Pencil,
  Scissors,
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
import { formatTime, formatWorkedEnd } from "@/lib/scheduling/constants";
import { formatDurationDelta } from "@/lib/scheduling/utils";
import {
  SHIFT_ACCENT,
  SHIFT_CARD_SURFACE,
  SHIFT_RAIL_BASE,
  type ShiftTone,
} from "@/lib/scheduling/accents";
import {
  PENDING_CARD_CLASS,
  ShiftPendingOverlay,
} from "./shift-pending";
import { ShiftSegments } from "./shift-segments";
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
  /**
   * Regroup the day — split these punches apart, or fold another shift in.
   *
   * Offered only when there is something to regroup: more than one punch
   * behind this shift, or another shift recorded the same day.
   */
  onAdjust?: (actual: ActualShift) => void;
  /** True when the same person has another recorded shift that day. */
  hasSameDayActuals?: boolean;
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
  onAdjust,
  hasSameDayActuals,
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
  if (actual.reviewState === "absent") {
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
  const isAdded = actual.timeVariance === "unplanned";
  /**
   * The server's verdict, taken as given.
   *
   * The grid used to soften this with a ten-minute tolerance, which meant a
   * two-minute punch showed a green card while the very same shift sat in the
   * Needs attention list — the colour and the filter contradicting each other
   * on screen. Whatever the server calls a difference, so do we. Note it
   * compares the LABEL as well as the times, so a renamed shift counts.
   */
  const isModified = !actual.isOpen && actual.timeVariance === "differs";
  const delta = plannedShift
    ? formatDurationDelta(plannedShift.durationMinutes, actual.durationMinutes)
    : null;
  const needsReview = actual.reviewState === "unreviewed";
  /**
   * Still on the clock, and past the server's cap for how long that can go on.
   *
   * A running shift is the one case the server leaves unflagged, so attention
   * on an open shift can only mean the clock-out never came. The hours stop
   * accruing at the cap; the shift never invents an end, because only a real
   * punch can close it.
   */
  const neverClockedOut = actual.isOpen && actual.needsAttention;
  /**
   * Signed off, and then the hours moved underneath them.
   *
   * TCP is the system of record: if a supervisor voids a punch there, the
   * duration drops here and the row resurfaces. The manager's verdict is
   * deliberately preserved — this says the verdict now covers different hours
   * than the ones they saw, which is the one `needs_attention` reason nothing
   * else on the card would show.
   */
  const changedSinceReview =
    actual.reviewState === "worked" &&
    actual.needsAttention &&
    // Only when nothing else already explains the flag. Hours that differ from
    // the plan are "time changed", which says more and says it plainly; this is
    // for the case where the shift still matches and was flagged anyway.
    !isModified &&
    !isAdded;
  /**
   * Green means the hours match the plan — the same thing it means in Compare,
   * so one shift never reads two ways depending on which tab you opened.
   *
   * An unreviewed but unremarkable punch is green too, and says "Recorded"
   * rather than "Worked as planned". It used to go amber, which lit a clean
   * week of clock-ins end to end and left the one shift that actually needed
   * looking at nothing to stand out from; whether anybody has signed it off is
   * a separate question, answered by the caption and by the attention filter.
   */
  const tone: ShiftTone = neverClockedOut
    ? // Sixteen hours on the clock is not a running shift, it is a mistake.
      "attention"
    : actual.isOpen
      ? "neutral"
      : isAdded
        ? "info"
        : isModified || changedSinceReview
          ? "attention"
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
            {needsReview && !actual.isOpen && onMarkReviewed && (
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
            {onAdjust && (actual.segments.length > 1 || hasSameDayActuals) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-white hover:text-white hover:bg-white/20"
                aria-label="Split or merge this shift"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjust(actual);
                }}
              >
                <Scissors className="h-3.5 w-3.5" />
              </Button>
            )}
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
            {actual.isOpen ? (
              // A quiet pulse, not a colour — `accents.ts` reserves the palette
              // for outcomes, and a shift still running is not an outcome.
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  neverClockedOut
                    ? "bg-amber-500"
                    : "animate-pulse bg-emerald-500",
                )}
              />
            ) : isModified || changedSinceReview ? (
              <Pencil className={cn("h-3 w-3 shrink-0", accent.text)} />
            ) : isAdded ? (
              <UserPlus className={cn("h-3 w-3 shrink-0", accent.text)} />
            ) : (
              <Check className={cn("h-3 w-3 shrink-0", accent.text)} />
            )}
            <span className="truncate">
              {formatTime(actual.startTime)} - {formatWorkedEnd(actual.endTime, actual.isOpen)}
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
              {neverClockedOut
                ? "Never clocked out"
                : actual.isOpen
                  ? "On the clock now"
                  : isAdded
                    ? "Added coverage"
                    : isModified
                      ? "Time changed"
                      : changedSinceReview
                        ? "Hours changed since review"
                        : actual.reviewState === "worked"
                          ? "Worked as planned"
                          : "Recorded"}
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
          {delta && !actual.isOpen && (
            <p
              className={cn(
                "mt-0.5 text-end text-[9px] font-semibold tabular-nums leading-none",
                accent.text,
              )}
            >
              {delta}
            </p>
          )}

          {/* Only draws itself when there is more than one punch behind this. */}
          <ShiftSegments segments={actual.segments} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs">
        <ShiftTooltipHeader
          time={`${formatTime(actual.startTime)} – ${formatWorkedEnd(actual.endTime, actual.isOpen)}`}
          hours={hours}
        />
        <ShiftTooltipStatus tone={tone}>
          {neverClockedOut
            ? "Never clocked out"
            : actual.isOpen
              ? "On the clock now"
              : isAdded
                ? "Worked without being planned"
                : isModified
                  ? "Time changed"
                  : changedSinceReview
                    ? "The hours changed since this was reviewed"
                    : actual.reviewState === "worked"
                      ? "Worked as planned"
                      : "Recorded, not yet reviewed"}
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

        {neverClockedOut && (
          <ShiftTooltipHint>
            The hours stopped counting at the cap. Only a real punch, or a
            correction on the time clock itself, can close this.
          </ShiftTooltipHint>
        )}

        {changedSinceReview && (
          <ShiftTooltipHint>
            Your verdict was kept, but it no longer covers these hours. Worth a
            second look.
          </ShiftTooltipHint>
        )}

        {needsReview && !actual.isOpen && (
          <ShiftTooltipHint>
            Tick to accept it, or edit to correct the times.
          </ShiftTooltipHint>
        )}

      </TooltipContent>
    </Tooltip>
  );
}
