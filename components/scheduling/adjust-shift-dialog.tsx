"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Scissors, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatTime, formatWorkedEnd } from "@/lib/scheduling/constants";
import { formatMinutes } from "@/lib/scheduling/utils";
import { formatSegmentTime } from "./shift-segments";
import type { ActualShift, ActualShiftSegment } from "@/types/scheduling.types";

/**
 * Correcting how the day was carved up.
 *
 * The backend groups punches less than an hour apart into one shift, which is
 * a sensible default rather than a verdict: somebody who went home at noon and
 * came back at half past is one shift, somebody who worked a morning and then
 * an evening is two. Both mistakes are possible and only a person can tell the
 * difference, so both are correctable here.
 *
 * Neither action touches the hours — merging counts the same punches once, and
 * splitting moves them between shifts. Nothing is sent to the time clock.
 */

interface AdjustShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shift the action was started from. */
  actual: ActualShift | null;
  /** Other recorded shifts for the same person on the same day. */
  sameDay: ActualShift[];
  employeeName: string;
  onSplit: (actual: ActualShift, segments: ActualShiftSegment[]) => void;
  onMerge: (into: ActualShift, others: ActualShift[]) => void;
}

function shiftRange(a: ActualShift): string {
  return `${formatTime(a.startTime)} – ${formatWorkedEnd(a.endTime, a.isOpen)}`;
}

export function AdjustShiftDialog({
  open,
  onOpenChange,
  actual,
  sameDay,
  employeeName,
  onSplit,
  onMerge,
}: AdjustShiftDialogProps) {
  const [pickedSegments, setPickedSegments] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pickedShifts, setPickedShifts] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Reopening on a different shift must not inherit the last one's ticks.
  useEffect(() => {
    setPickedSegments(new Set());
    setPickedShifts(new Set());
  }, [actual?.id, open]);

  const segments = actual?.segments ?? [];
  const canSplit = segments.length > 1;

  /**
   * Moving every segment would leave the source shift with nothing, which the
   * server refuses with `INVALID_SPLIT`. Cheaper and clearer to say so here
   * than to let someone tick them all and read an error.
   */
  const allSegmentsPicked =
    canSplit && pickedSegments.size === segments.length;
  const splitReady = pickedSegments.size > 0 && !allSegmentsPicked;

  const movedMinutes = useMemo(
    () =>
      segments
        .filter((seg) => pickedSegments.has(seg.id))
        .reduce((n, seg) => n + (seg.durationMinutes ?? 0), 0),
    [segments, pickedSegments],
  );

  const mergeable = sameDay.filter((a) => a.id !== actual?.id);
  const mergeReady = pickedShifts.size > 0;

  if (!actual) return null;

  const toggle = (
    set: ReadonlySet<string>,
    setter: (s: ReadonlySet<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust recorded shift</DialogTitle>
          <DialogDescription>
            {employeeName} · {shiftRange(actual)} ·{" "}
            {formatMinutes(actual.durationMinutes)} worked
          </DialogDescription>
        </DialogHeader>

        {actual.groupingPinned && (
          <p className="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground">
            Somebody has already adjusted this one by hand, so the automatic
            grouping will leave it alone from now on.
          </p>
        )}

        {/* ── Split ─────────────────────────────────────────────────── */}
        {canSplit && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Was this two shifts?</p>
              <p className="text-xs text-muted-foreground">
                Tick the punches that belong to the second shift. The rest stay
                on this one.
              </p>
            </div>

            <ul className="space-y-1.5">
              {segments.map((seg, i) => (
                <li key={seg.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`seg-${seg.id}`}
                    checked={pickedSegments.has(seg.id)}
                    onCheckedChange={() =>
                      toggle(pickedSegments, setPickedSegments, seg.id)
                    }
                  />
                  <Label
                    htmlFor={`seg-${seg.id}`}
                    className="flex flex-1 items-center gap-2 text-xs font-normal"
                  >
                    <span className="text-muted-foreground">{i + 1}</span>
                    <span className="tabular-nums">
                      {formatSegmentTime(seg.timeIn)}–
                      {formatSegmentTime(seg.timeOut)}
                    </span>
                    {seg.durationMinutes !== null && (
                      <span className="text-muted-foreground">
                        {formatMinutes(seg.durationMinutes)}
                      </span>
                    )}
                    {seg.hasMissedPunch && (
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    )}
                  </Label>
                </li>
              ))}
            </ul>

            {allSegmentsPicked && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Leave at least one punch behind — a shift cannot end up empty.
              </p>
            )}

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!splitReady}
              onClick={() => {
                onSplit(
                  actual,
                  segments.filter((seg) => pickedSegments.has(seg.id)),
                );
                onOpenChange(false);
              }}
            >
              <Scissors className="h-3.5 w-3.5" />
              Split off {formatMinutes(movedMinutes)}
            </Button>
          </div>
        )}

        {/* ── Merge ─────────────────────────────────────────────────── */}
        {mergeable.length > 0 && (
          <div className={cn("space-y-2", canSplit && "border-t pt-3")}>
            <div>
              <p className="text-sm font-medium">Was this all one shift?</p>
              <p className="text-xs text-muted-foreground">
                Tick anything recorded separately that was really part of this
                shift. The hours do not change.
              </p>
            </div>

            <ul className="space-y-1.5">
              {mergeable.map((other) => (
                <li key={other.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`merge-${other.id}`}
                    checked={pickedShifts.has(other.id)}
                    onCheckedChange={() =>
                      toggle(pickedShifts, setPickedShifts, other.id)
                    }
                  />
                  <Label
                    htmlFor={`merge-${other.id}`}
                    className="flex flex-1 items-center gap-2 text-xs font-normal tabular-nums"
                  >
                    {shiftRange(other)}
                    <span className="text-muted-foreground">
                      {formatMinutes(other.durationMinutes)}
                    </span>
                  </Label>
                </li>
              ))}
            </ul>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!mergeReady}
              onClick={() => {
                onMerge(
                  actual,
                  mergeable.filter((a) => pickedShifts.has(a.id)),
                );
                onOpenChange(false);
              }}
            >
              <Merge className="h-3.5 w-3.5" />
              Merge into this shift
            </Button>
          </div>
        )}

        {!canSplit && mergeable.length === 0 && (
          <p className="text-xs text-muted-foreground">
            One shift, one punch, nothing else recorded that day — there is
            nothing to regroup.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
