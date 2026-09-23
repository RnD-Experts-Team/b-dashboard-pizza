"use client";

import { Check, Clock, Pencil, StickyNote, Trash2 } from "lucide-react";
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
import type { ActualShift, Shift } from "@/types/scheduling.types";

/**
 * A planned shift shown together with the clock-in(s) recorded against it.
 *
 * The backend sends clock-ins unlinked (`planned_shift_id: null`), so the grid
 * used to draw the plan and the punch as two unrelated cards — one captioned
 * "not in the original plan" for a shift that was planned. `groupClockInsByPlan`
 * infers the pairing; this renders it as one thing needing a look.
 *
 * Shape mirrors the Compare card — plan on top, reality underneath, same order
 * in every cell — so the two views read the same way. The difference is that
 * here the recorded rows are editable, because Actual is where attendance gets
 * corrected.
 *
 * `attention` (amber), not `info` (violet): violet means unplanned, and the
 * whole point of this card is that the shift WAS planned.
 *
 * Agreeing LINKS the punch to the plan — one call, and the punch row is left
 * exactly as the clock recorded it. It must never re-enter the times and delete
 * the original: actuals write through to TCP, so that would swap real payroll
 * evidence for a manager-typed record.
 */

interface TimeclockReviewCardProps {
  plannedShift: Shift;
  clockIns: ActualShift[];
  onEdit: (plannedShift: Shift | undefined, actual: ActualShift) => void;
  onDelete: (actual: ActualShift) => void;
  /**
   * Accept the punch as this shift's actual. Absent when the card holds more
   * than one punch — see the note on the button below.
   */
  onAgree?: (plannedShift: Shift, clockIn: ActualShift) => void;
  /** An action on this shift or one of its punches is in flight. */
  isPending?: boolean;
}

export function TimeclockReviewCard({
  plannedShift,
  clockIns,
  onEdit,
  onDelete,
  onAgree,
  isPending,
}: TimeclockReviewCardProps) {
  const workedMinutes = clockIns.reduce((n, a) => n + a.durationMinutes, 0);
  // Total recorded minutes across every punch, against the planned duration.
  const delta = formatDurationDelta(plannedShift.durationMinutes, workedMinutes);

  /**
   * Two different questions, deliberately kept apart.
   *
   * Grouping answers "which plan does this punch belong to" — a structural
   * link. `review_state` answers "has a human looked at it". A punch someone
   * already amended is still unlinked, so it still groups, but it should read
   * calmly rather than shout for attention it has already had.
   *
   * Undefined on responses predating the field, in which case the card keeps
   * its previous behaviour and treats grouping itself as the signal.
   */
  const needsReview = clockIns.some((a) => a.reviewState === "unreviewed");
  const accent = SHIFT_ACCENT[needsReview ? "attention" : "neutral"];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "relative overflow-hidden ps-2 pe-1.5 py-1 text-[10px] sm:text-xs",
            SHIFT_CARD_SURFACE,
            isPending && PENDING_CARD_CLASS,
          )}
        >
          {isPending && <ShiftPendingOverlay />}
          {needsReview && (
            <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />
          )}

          {/* Plan — context, not the record, so it is muted and has no actions. */}
          <div className="flex items-baseline gap-1.5">
            <span className="w-6 shrink-0 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground/70">
              Plan
            </span>
            <span className="min-w-0 flex-1 truncate font-medium leading-tight text-muted-foreground">
              {formatTime(plannedShift.startTime)}–
              {formatTime(plannedShift.endTime)}
            </span>
          </div>

          <span className="my-0.5 block h-px bg-border/50" />

          {/*
            One row per recorded shift. Two rows means two genuinely separate
            shifts that day — the backend rolls punches less than an hour apart
            into ONE shift with several segments, which `ShiftSegments` breaks
            out underneath rather than listing here as if they were unrelated.
          */}
          {clockIns.map((a, i) => (
            <div key={a.id} className="group/row">
            <div className="flex items-baseline gap-1.5">
              <span className="w-6 shrink-0 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground/70">
                {i === 0 ? "In" : ""}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium leading-tight",
                  accent.text,
                )}
              >
                {formatTime(a.startTime)}–{formatWorkedEnd(a.endTime, a.isOpen)}
              </span>
              {a.note && (
                <StickyNote className="h-2.5 w-2.5 shrink-0 text-amber-500 dark:text-amber-400" />
              )}
              <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-sm text-muted-foreground hover:text-foreground"
                  aria-label="Edit recorded time"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(plannedShift, a);
                  }}
                >
                  <Pencil className="h-2.5 w-2.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-sm text-muted-foreground hover:text-rose-500"
                  aria-label="Delete recorded time"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(a);
                  }}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </span>
            </div>
            <ShiftSegments segments={a.segments} />
            </div>
          ))}

          <div className="mt-0.5 flex items-center gap-1">
            <Clock className={cn("h-2.5 w-2.5 shrink-0", accent.text)} />
            <p className={cn("min-w-0 flex-1 truncate text-[9px] leading-tight", accent.text)}>
              {needsReview ? "Needs review" : "Not linked to the plan"}
              {delta ? ` · ${delta}` : ""}
            </p>
            {/*
              Offered only when there is one recorded shift to accept. Two means
              they came in twice that day, and there is no single pair of times
              that honestly covers both — those are resolved one at a time by
              editing. A shift with several PUNCHES is still one shift and is
              still offered, because the server has already summed it.
            */}
            {onAgree && clockIns.length === 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 shrink-0 rounded-sm text-muted-foreground hover:text-emerald-600"
                aria-label="Agree — record this clock-in as the actual"
                onClick={(e) => {
                  e.stopPropagation();
                  onAgree(plannedShift, clockIns[0]);
                }}
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </TooltipTrigger>

      <TooltipContent side="top" className="max-w-60 text-xs">
        <ShiftTooltipHeader
          time={clockIns
            .map((a) => `${formatTime(a.startTime)} – ${formatWorkedEnd(a.endTime, a.isOpen)}`)
            .join(", ")}
          hours={workedMinutes / 60}
        />
        <ShiftTooltipStatus tone={needsReview ? "attention" : "neutral"}>
          {needsReview ? "Clocked in, not yet reviewed" : "Not linked to the plan"}
        </ShiftTooltipStatus>

        <ShiftTooltipBody>
          <ShiftTooltipRow label="Source">Time clock</ShiftTooltipRow>
          <ShiftTooltipRow label="Plan">
            {formatTime(plannedShift.startTime)} –{" "}
            {formatTime(plannedShift.endTime)} (
            {(plannedShift.durationMinutes / 60).toFixed(1)}h)
          </ShiftTooltipRow>
          {delta && (
            <ShiftTooltipRow label="Against">{delta} the plan</ShiftTooltipRow>
          )}
        </ShiftTooltipBody>

        <ShiftTooltipHint>
          {clockIns.length === 1
            ? "Tick to accept these times, or edit them first if the clock got it wrong."
            : "They came in more than once that day, so there is no single pair of times to accept — handle each one on its own."}
        </ShiftTooltipHint>
      </TooltipContent>
    </Tooltip>
  );
}
