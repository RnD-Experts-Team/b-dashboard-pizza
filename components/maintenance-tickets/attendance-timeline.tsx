"use client";

import { useMemo, useState } from "react";
import { Clock, Car, Coffee, Package, LogOut, ArrowRightLeft, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "./form-bits";
import {
  TIMELINE_STEPS,
  formatMinutes,
  handoffAt,
  isOnTheClock,
  nextSteps,
  nowForInput,
  recordedEvents,
  spanMinutes,
  type TimelineFieldKey,
  type TimelineStep,
  type TimelineValue,
} from "@/lib/maintenance-tickets/attendance-timeline";

/**
 * Attendance, entered the way it actually happens.
 *
 * Instead of eight empty fields, the coordinator sees what has been recorded so
 * far as a short list of sentences, and a row of buttons for what happened
 * next. Pressing one stamps the current time; every stamp stays editable,
 * because the technician will ring back and say he actually got there at 9:15.
 *
 * "Now" and "type it in" are the same control, not two modes to learn: the
 * button fills the time and the pencil opens the picker on the same value. That
 * is the merge between manual and automatic the author asked for -- automatic
 * enough to be one press live, manual enough to fix afterwards.
 *
 * Break is deliberately the only step with no "paid" mark. That is how the rule
 * gets learned rather than explained.
 */

const STEP_ICONS: Record<TimelineFieldKey, typeof Clock> = {
  startClock: Clock,
  endClock: LogOut,
  startTravel: Car,
  endTravel: Car,
  startBreak: Coffee,
  endBreak: Coffee,
  startPartsRun: Package,
  endPartsRun: Package,
};

interface AttendanceTimelineProps {
  value: Partial<TimelineValue>;
  onChange: (patch: Partial<TimelineValue>) => void;
  /** Offers the store handoff. Omit where there is nowhere to hand off to. */
  onMoveToAnotherStore?: (closeCurrent: Partial<TimelineValue>) => void;
  disabled?: boolean;
  className?: string;
}

export function AttendanceTimeline({
  value,
  onChange,
  onMoveToAnotherStore,
  disabled = false,
  className,
}: AttendanceTimelineProps) {
  const [editing, setEditing] = useState<TimelineFieldKey | null>(null);

  const events = useMemo(() => recordedEvents(value), [value]);
  const available = useMemo(() => nextSteps(value), [value]);
  const onClock = isOnTheClock(value);

  function stamp(step: TimelineStep) {
    onChange({ [step.key]: nowForInput() } as Partial<TimelineValue>);
  }

  function handleHandoff() {
    const { closeCurrent } = handoffAt();
    onChange(closeCurrent);
    onMoveToAnotherStore?.(closeCurrent);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing recorded yet. Start when the technician goes on the clock.
        </p>
      ) : (
        <ol className="space-y-1">
          {events.map((event) => {
            const Icon = STEP_ICONS[event.step.key];
            // A closing step shows how long the span it closed was.
            const minutes =
              event.step.edge === "end"
                ? spanMinutes(value[event.step.pair], event.at)
                : null;
            const duration = formatMinutes(minutes);
            const isEditing = editing === event.step.key;

            return (
              <li
                key={event.step.key}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-2.5 py-2"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm">{event.step.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {event.at.slice(11, 16)}
                </span>

                {duration && (
                  <span className="text-xs text-muted-foreground">({duration})</span>
                )}

                {/* Paid spans say so; break says nothing, which is the whole
                    lesson. Only on the closing half, where the span is real. */}
                {duration && event.step.edge === "end" && event.step.paid && (
                  <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    paid
                  </span>
                )}
                {duration && event.step.edge === "end" && !event.step.paid && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    not paid
                  </span>
                )}

                <div className="ms-auto flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <DateTimePicker
                        value={event.at}
                        onChange={(v) =>
                          onChange({ [event.step.key]: v } as Partial<TimelineValue>)
                        }
                        disabled={disabled}
                        className="h-7 w-56"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditing(null)}
                        aria-label="Done editing"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={disabled}
                      onClick={() => setEditing(event.step.key)}
                      aria-label={`Change when he ${event.step.label.toLowerCase()}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* What happened next. Only what makes sense right now appears -- but
          nothing already recorded is locked, so an odd order is still fixable
          through the pencil above. */}
      {available.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {events.length === 0 ? "Start here" : "What happened next?"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((step) => {
              const Icon = STEP_ICONS[step.key];
              return (
                <Button
                  key={step.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => stamp(step)}
                >
                  <Icon className="me-1.5 h-3.5 w-3.5" />
                  {step.label}
                </Button>
              );
            })}

            {onClock && onMoveToAnotherStore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={handleHandoff}
                // Says exactly what the one press writes, because it writes
                // three stamps and a silent one would be untrustworthy.
                title="Clocks him out here and starts a new visit at the next store, with the drive counted there"
              >
                <ArrowRightLeft className="me-1.5 h-3.5 w-3.5" />
                Moving to another store
              </Button>
            )}
          </div>
          {onClock && onMoveToAnotherStore && (
            <p className="text-[11px] text-muted-foreground">
              Moving on clocks him out here and starts the next store at the same minute, with the
              drive counted against the store he is going to.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The step vocabulary, re-exported so callers do not reach into lib for a label. */
export { TIMELINE_STEPS };
