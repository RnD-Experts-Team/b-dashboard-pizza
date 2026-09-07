"use client";

import { Check, Clock, Pencil, StickyNote, Trash2 } from "lucide-react";
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
 * Agreeing writes a linked actual from the punch's times AND deletes the
 * unlinked punch. Both halves matter: without the delete the same work counts
 * twice, once through the plan and once as ad-hoc coverage.
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
}

/** Total recorded minutes across every punch, against the planned duration. */
function deltaLabel(plannedMinutes: number, workedMinutes: number): string | null {
  const diff = workedMinutes - plannedMinutes;
  if (diff === 0) return null;
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h ${String(m).padStart(2, "0")}m` : `${sign}${m}m`;
}

export function TimeclockReviewCard({
  plannedShift,
  clockIns,
  onEdit,
  onDelete,
  onAgree,
}: TimeclockReviewCardProps) {
  const accent = SHIFT_ACCENT.attention;
  const workedMinutes = clockIns.reduce((n, a) => n + a.durationMinutes, 0);
  const delta = deltaLabel(plannedShift.durationMinutes, workedMinutes);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "relative overflow-hidden ps-2 pe-1.5 py-1 text-[10px] sm:text-xs",
            SHIFT_CARD_SURFACE,
          )}
        >
          <span aria-hidden className={cn(SHIFT_RAIL_BASE, accent.rail)} />

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

          {/* Each punch is separately editable — a lunch break produces two. */}
          {clockIns.map((a, i) => (
            <div key={a.id} className="group/row flex items-baseline gap-1.5">
              <span className="w-6 shrink-0 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground/70">
                {i === 0 ? "In" : ""}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium leading-tight",
                  accent.text,
                )}
              >
                {formatTime(a.startTime)}–{formatTime(a.endTime)}
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
          ))}

          <div className="mt-0.5 flex items-center gap-1">
            <Clock className={cn("h-2.5 w-2.5 shrink-0", accent.text)} />
            <p className={cn("min-w-0 flex-1 truncate text-[9px] leading-tight", accent.text)}>
              Needs review
              {delta ? ` · ${delta}` : ""}
            </p>
            {/*
              Offered only for a single punch. With two (a lunch break) there is
              no honest single pair of times to accept — the span would silently
              bill the break as worked — so those are resolved by editing.
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

      <TooltipContent side="top" className="max-w-56 text-xs">
        <p className="font-semibold">Clocked in, not yet reviewed</p>
        <p className="mt-1">
          <span className="opacity-70">Planned: </span>
          {formatTime(plannedShift.startTime)} –{" "}
          {formatTime(plannedShift.endTime)} (
          {(plannedShift.durationMinutes / 60).toFixed(1)}h)
        </p>
        <p>
          <span className="opacity-70">
            {clockIns.length > 1 ? `Clocked (${clockIns.length}): ` : "Clocked: "}
          </span>
          {(workedMinutes / 60).toFixed(1)}h
        </p>
        {delta && <p className="mt-0.5 font-medium">{delta} against the plan</p>}
        <p className="mt-0.5 opacity-80">
          {clockIns.length === 1
            ? "Agree to record these clocked times as the actual for this shift, or edit them first if the clock got it wrong."
            : "Two or more punches, so there is no single pair of times to accept — edit or delete them individually."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
