"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  Coffee,
  CornerDownLeft,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Package,
  Pencil,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "./form-bits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EVENT_STEPS,
  formatSpan,
  isOnTheClock,
  nextEventKinds,
  nowForInput,
  orderedEvents,
  spanClosedBy,
  type EventStep,
} from "@/lib/maintenance-tickets/attendance-events";
import type { AttendanceEvent, AttendanceEventKind } from "@/types/maintenance-tickets.types";

/**
 * What happened during one session, and what can happen next.
 *
 * ONE COMPONENT, TWO PLACES. On the ticket page it renders read-only, so who is
 * on the clock is answerable without opening anything; in the recording panel
 * the same list gains its controls. Handing it no callbacks is what makes it
 * read-only — there is no second copy of this markup to drift.
 *
 * EVERY PRESS WRITES. There is no save step and nothing to finish. That is the
 * whole change: recording a clock-in and then wanting to add "he set off at
 * 08:30" used to mean flagging the record wrong and typing it again, because
 * after creation the only mutation the API had was mistaken = true.
 *
 * BOTH TIME MODES, NEITHER SECOND-CLASS. The coordinator is not the technician:
 * some days they follow a visit live, some days they write up a backlog from a
 * phone call. So every step offers "now" as one press AND a time box, rather
 * than making one of those the exception that costs extra work.
 */

const ICONS: Record<AttendanceEventKind, LucideIcon> = {
  clock_in: LogIn,
  clock_out: LogOut,
  travel_start: Truck,
  travel_end: CornerDownLeft,
  parts_run_start: Package,
  parts_run_end: CornerDownLeft,
  break_start: Coffee,
  break_end: CornerDownLeft,
};

interface AttendanceStreamProps {
  events: AttendanceEvent[];
  /** Absent means read-only. Present means every button writes immediately. */
  onRecord?: (kind: AttendanceEventKind, at: string) => Promise<void>;
  onCorrect?: (event: AttendanceEvent, at: string) => Promise<void>;
  onStrike?: (event: AttendanceEvent) => Promise<void>;
  /** A session already on a pay sheet cannot have its times rewritten. */
  isPaid?: boolean;
  className?: string;
}

export function AttendanceStream({
  events,
  onRecord,
  onCorrect,
  onStrike,
  isPaid = false,
  className,
}: AttendanceStreamProps) {
  const [busy, setBusy] = useState<string | null>(null);
  /** Which step is having a time typed into it, before it is written. */
  const [pending, setPending] = useState<{ step: EventStep; at: string } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const shown = orderedEvents(events);
  const steps = nextEventKinds(events);
  const onClock = isOnTheClock(events);
  const interactive = Boolean(onRecord);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing recorded yet. Start when the technician goes on the clock.
        </p>
      ) : (
        <ol className="space-y-1">
          {shown.map((event) => {
            const Icon = ICONS[event.kind] ?? Clock;
            const duration = formatSpan(spanClosedBy(events, event));
            const isEditing = editing === event.id;

            return (
              <li
                key={event.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-md border bg-card px-2.5 py-2",
                  // Struck through and dimmed, but still here. A flagged event
                  // is part of the trail; removing it would defeat the point.
                  event.mistaken && "border-dashed opacity-60 [&_span]:line-through"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {/* The server's own label, so the two sides cannot disagree
                    about what a kind is called. */}
                <span className="text-sm">{event.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {event.at.slice(11, 16)}
                </span>

                {duration && <span className="text-xs text-muted-foreground">({duration})</span>}

                {/* Paid spans say so; break says nothing, which is the whole
                    lesson. Only on the closing half, where the span is real. */}
                {duration && !event.opens && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-medium no-underline!",
                      event.paid
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {event.paid ? "paid" : "not paid"}
                  </span>
                )}

                {event.mistaken && (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground no-underline!">
                    mistake
                  </span>
                )}

                {interactive && !event.mistaken && (
                  <div className="ms-auto flex items-center gap-1">
                    {isEditing ? (
                      <InlineTime
                        initial={event.at.slice(0, 16)}
                        busy={busy === `edit-${event.id}`}
                        onCancel={() => setEditing(null)}
                        onConfirm={(at) =>
                          run(`edit-${event.id}`, async () => {
                            await onCorrect?.(event, at);
                            setEditing(null);
                          })
                        }
                      />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Change ${event.label.toLowerCase()}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={isPaid}
                            onSelect={() => setEditing(event.id)}
                          >
                            <Pencil className="me-2 h-3.5 w-3.5" />
                            {isPaid ? "Already paid — cannot change the time" : "Change the time"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void run(`strike-${event.id}`, () => onStrike?.(event) ?? Promise.resolve())
                            }
                          >
                            <X className="me-2 h-3.5 w-3.5" />
                            This never happened
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {interactive && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {shown.length === 0 ? "Start here" : "What happened next?"}
          </p>

          {pending ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 p-2">
              <span className="text-xs font-medium">{pending.step.label}</span>
              <InlineTime
                initial={pending.at}
                busy={busy === "pending"}
                confirmLabel="Record it"
                onCancel={() => setPending(null)}
                onConfirm={(at) =>
                  run("pending", async () => {
                    await onRecord?.(pending.step.kind, at);
                    setPending(null);
                  })
                }
              />
            </div>
          ) : (
            /*
              One SEGMENTED control per step, wrapping.

              It was a stacked row per step with two loose buttons -- eight
              controls in a column, which read as a list to get through rather
              than a choice to make. Joined, each step is one thing with two
              ways to commit it, and the row wraps to however much width there
              is instead of always being four rows tall.
            */
            <div className="flex flex-wrap gap-2">
              {steps.map((step) => {
                const Icon = ICONS[step.kind] ?? Clock;
                const key = `record-${step.kind}`;

                return (
                  <div
                    key={step.kind}
                    className="inline-flex items-stretch overflow-hidden rounded-md border bg-card"
                  >
                    {/* Live: one press, stamped now. */}
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(key, () => onRecord?.(step.kind, nowForInput()) ?? Promise.resolve())
                      }
                      className="inline-flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {busy === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      )}
                      {step.label}
                    </button>

                    {/*
                      Writing up yesterday. Same control, same height, divided
                      rather than demoted -- the coordinator is not the
                      technician, and recording a visit after the fact is not
                      the exception that should cost extra.
                    */}
                    <button
                      type="button"
                      disabled={busy !== null}
                      title={`Record ${step.label.toLowerCase()} at a time you type`}
                      onClick={() => setPending({ step, at: nowForInput() })}
                      className="inline-flex h-9 items-center border-s px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      at a time…
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Visible without opening anything, which is the point of putting this
          on the ticket page read-only as well. */}
      {onClock && !interactive && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          On the clock — no clock-out yet.
        </p>
      )}
    </div>
  );
}

/**
 * A time box with its own confirm.
 *
 * Deliberately NOT save-on-change: every change here is a write, and firing one
 * per keystroke would put a dozen rows in the audit trail for one correction.
 */
function InlineTime({
  initial,
  busy,
  confirmLabel = "Save",
  onConfirm,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  confirmLabel?: string;
  onConfirm: (at: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  return (
    <div className="flex items-center gap-1">
      <DateTimePicker value={value} onChange={setValue} disabled={busy} className="h-8 w-56" />
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1 text-xs"
        disabled={busy || !value}
        onClick={() => onConfirm(value)}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        {confirmLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 text-xs"
        disabled={busy}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  );
}
