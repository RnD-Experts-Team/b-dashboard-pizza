"use client";

import { Ban, Clock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { calcHours, formatTime } from "@/lib/scheduling/constants";
import {
  SHIFT_ACCENT,
  SHIFT_CARD_SURFACE,
  SHIFT_RAIL_BASE,
} from "@/lib/scheduling/accents";
import type { DraftShift } from "@/lib/scheduling/draft.store";

/**
 * A shift the manager has laid out but not saved yet.
 *
 * Kept as its own component rather than a variant of `ShiftCard`, because a
 * draft genuinely has less information: no `shiftId`, no `durationMinutes` from
 * the server, no sync status, and — importantly — **no conflict or overtime
 * signal**. Those are computed server-side on UTC instants over saved shifts
 * only, so a draft cannot be checked against them until it is saved. Sharing the
 * card would have meant passing `hasConflict={false}` and quietly implying the
 * shift had been checked and cleared.
 *
 * `calcHours` is legitimate here for the same reason it is in the add dialog:
 * these times have no server-computed duration yet.
 */

interface DraftShiftCardProps {
  draft: DraftShift;
  /**
   * Set when the draft falls inside blocked availability or approved leave.
   *
   * The card keeps its amber dashed "unsaved" styling and gains a marker rather
   * than changing colour — amber already means "not saved yet" here, and
   * recolouring would make two different states look identical.
   */
  blockedReason?: string | null;
  onEdit: (draft: DraftShift) => void;
  onDelete: (draftId: string) => void;
}

export function DraftShiftCard({
  draft,
  blockedReason,
  onEdit,
  onDelete,
}: DraftShiftCardProps) {
  const hours = calcHours(draft.startTime, draft.endTime);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "group relative cursor-pointer overflow-hidden px-1.5 sm:px-2 py-1 sm:py-1.5 text-[10px] sm:text-xs transition-all",
            SHIFT_CARD_SURFACE,
            // Dashed border is what says "not saved yet" — no fill, so an
            // unsaved shift reads as provisional rather than as a warning.
            "border-dashed",
          )}
          onClick={() => onEdit(draft)}
        >
          {/* Hover actions, same affordance as a saved card */}
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-md bg-black/80 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-white hover:bg-white/20 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(draft);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md text-rose-400 hover:bg-white/20 hover:text-rose-300"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(draft.draftId);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* A blocked draft still earns a rail — it is a real clash. */}
          {blockedReason && (
            <span
              aria-hidden
              className={cn(SHIFT_RAIL_BASE, SHIFT_ACCENT.attention.rail)}
            />
          )}

          <div className="flex items-center gap-1 font-semibold leading-tight text-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {formatTime(draft.startTime)} - {formatTime(draft.endTime)}
            </span>
            {blockedReason && (
              <Ban
                className={cn(
                  "ms-auto h-3 w-3 shrink-0",
                  SHIFT_ACCENT.attention.text,
                )}
              />
            )}
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-1">
            <p className="truncate text-[10px] leading-tight text-muted-foreground">
              {draft.label}
            </p>
            <span className="shrink-0 rounded-sm bg-amber-500/20 px-1 text-[8px] font-bold uppercase leading-tight tracking-wide text-amber-700 dark:text-amber-300">
              Unsaved
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-xs">
        <p className="font-semibold">{draft.label} Shift — not saved</p>
        <p>
          {formatTime(draft.startTime)} – {formatTime(draft.endTime)} (
          {hours.toFixed(1)}h)
        </p>
        <p className="mt-0.5 opacity-90">
          This shift only exists on your screen. Press Save to schedule it.
        </p>
        <p className="mt-0.5 opacity-75">
          Overlaps and overtime are checked when it is saved.
        </p>
        {blockedReason && (
          <p className={cn("mt-0.5 font-medium", SHIFT_ACCENT.attention.text)}>
            ⚠ {blockedReason}
          </p>
        )}
        {draft.note && (
          <p className="mt-0.5 italic text-amber-600 dark:text-amber-400">
            📝 {draft.note}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
