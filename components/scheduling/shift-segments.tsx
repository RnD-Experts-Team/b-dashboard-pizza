"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/scheduling/constants";
import { formatMinutes, offClockMinutes } from "@/lib/scheduling/utils";
import type {
  ActualShiftSegment,
  SegmentOrigin,
} from "@/types/scheduling.types";

/**
 * The punches behind one shift.
 *
 * A shift used to be a single clock-in/clock-out pair. It is now a roll-up:
 * punching out and back in closes one segment and opens another, so a day with
 * a half hour off the clock arrives as two. The hours follow the segments, not
 * the span — 9:00 to 5:00 with a 30-minute gap is paid as 7.5, and without this
 * list the card shows those two facts side by side and explains neither.
 *
 * Renders nothing for the ordinary one-segment shift; there is no breakdown to
 * give when the breakdown is the shift.
 */

/**
 * "2026-08-06 09:00:00" → "9:00 AM".
 *
 * Sliced, never parsed. These stamps are store-local wall clock with no offset,
 * so handing one to `new Date()` invites an engine to read it as UTC and shift
 * every punch by the store's offset.
 */
export function formatSegmentTime(stamp: string | null): string {
  if (!stamp) return "still on the clock";
  return formatTime(stamp.slice(11, 16));
}

/** Where the punch was made — the question this whole model exists to answer. */
const ORIGIN_LABEL: Record<SegmentOrigin, string> = {
  punch: "Clocked in through this app",
  manual: "Entered by hand",
  discovered: "Found on the time clock",
};

export function ShiftSegments({
  segments,
  className,
}: {
  segments: ActualShiftSegment[];
  className?: string;
}) {
  if (segments.length < 2) return null;

  const offClock = offClockMinutes(segments);

  return (
    <div className={cn("mt-1 border-t pt-1", className)}>
      <ul className="space-y-0.5">
        {segments.map((seg, i) => (
          <li
            key={seg.id}
            className="flex items-baseline gap-1.5 text-[10px] leading-tight"
          >
            <span className="w-6 shrink-0 text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground/70">
              {i + 1}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="min-w-0 flex-1 truncate tabular-nums text-muted-foreground">
                  {formatSegmentTime(seg.timeIn)}–{formatSegmentTime(seg.timeOut)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {ORIGIN_LABEL[seg.origin]}
                {seg.note ? ` · ${seg.note}` : ""}
              </TooltipContent>
            </Tooltip>
            {seg.hasMissedPunch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle
                    aria-label="The time clock flagged a missed punch"
                    className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-52 text-xs">
                  The time clock flagged this one — the time shown is its own
                  default, not something the employee punched.
                </TooltipContent>
              </Tooltip>
            )}
          </li>
        ))}
      </ul>

      {/*
        Without this the card looks like it has dropped half an hour: the times
        say 9 to 5 and the hours say 7.5, with nothing between them.
      */}
      {offClock > 0 && (
        <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">
          {formatMinutes(offClock)} off the clock, not counted
        </p>
      )}
    </div>
  );
}
