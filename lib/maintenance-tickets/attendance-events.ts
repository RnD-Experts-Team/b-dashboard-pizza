/**
 * Attendance as a story you add to, not a form you fill in.
 *
 * The coordinator is usually on the phone to the technician:
 *
 *   "he clocked in, and we start a travel time from when he gets out of his
 *    house till he gets to the store he will be working on, he arrived we
 *    finish the travel time, he worked and inspected, he went to get items, he
 *    came back, he went on a break, he ended the break"
 *
 * Showing eight fields at once turns that into data entry. This module answers
 * two questions instead: what has happened so far, and what can sensibly happen
 * next.
 *
 * WHAT CHANGED. This replaces the field-keyed model in `attendance-timeline.ts`,
 * which mirrored four fixed start/end column pairs. Those are gone: each event
 * is now its own record, so a session holds as many breaks, travels and parts
 * runs as the day actually had, and a saved session can be added to instead of
 * being corrected and retyped.
 *
 * WHAT A CLOCK WINDOW MEANS (confirmed with the author, and matching
 * AttendanceEntry::durations() upstream): one window is ONE PAID SEGMENT
 * ATTRIBUTABLE TO ONE STORE, not a working day. Clock-out at store A IS
 * clock-in at store B. The drive to a store belongs to that store's segment;
 * the drive home belongs to the last one. Coming back to store A later is a new
 * segment — which is why a clock-in on an open session opens a new one.
 *
 * Travel and parts-run are PAID; break is NOT.
 *
 * Pure: no React, no service calls.
 */

import type { AttendanceEvent, AttendanceEventKind } from "@/types/maintenance-tickets.types";

export interface EventStep {
  kind: AttendanceEventKind;
  /** What the coordinator would say out loud. */
  label: string;
  /** Does the stretch of time this belongs to earn money? */
  paid: boolean;
  opens: boolean;
  bucket: "work" | "travel" | "break" | "parts_run";
}

/**
 * The vocabulary, mirrored from the server enum.
 *
 * Duplicated rather than derived because the buttons have to exist before any
 * event does — on a session with nothing recorded there is nothing to read a
 * label off. The server sends `label` on every event it returns, so anything
 * already recorded is rendered from ITS copy, and this table only ever supplies
 * the not-yet-pressed buttons.
 */
export const EVENT_STEPS: Record<AttendanceEventKind, EventStep> = {
  clock_in: { kind: "clock_in", label: "Clocked in", paid: true, opens: true, bucket: "work" },
  travel_start: { kind: "travel_start", label: "Started driving", paid: true, opens: true, bucket: "travel" },
  travel_end: { kind: "travel_end", label: "Arrived", paid: true, opens: false, bucket: "travel" },
  parts_run_start: { kind: "parts_run_start", label: "Left to get parts", paid: true, opens: true, bucket: "parts_run" },
  parts_run_end: { kind: "parts_run_end", label: "Back with parts", paid: true, opens: false, bucket: "parts_run" },
  break_start: { kind: "break_start", label: "Went on break", paid: false, opens: true, bucket: "break" },
  break_end: { kind: "break_end", label: "Back from break", paid: false, opens: false, bucket: "break" },
  clock_out: { kind: "clock_out", label: "Clocked out", paid: true, opens: false, bucket: "work" },
};

/** The events that count, oldest first by WHEN THEY HAPPENED. */
export function liveEvents(events: AttendanceEvent[]): AttendanceEvent[] {
  return events
    .filter((e) => !e.mistaken)
    .slice()
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Everything in order, struck ones included — a struck event is part of the
 *  trail and hiding it would defeat the reason the flag exists. */
export function orderedEvents(events: AttendanceEvent[]): AttendanceEvent[] {
  return events.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** True while somebody is on the clock with no clock-out yet. */
export function isOnTheClock(events: AttendanceEvent[]): boolean {
  const live = liveEvents(events);
  return (
    live.some((e) => e.kind === "clock_in") && !live.some((e) => e.kind === "clock_out")
  );
}

/** Whichever span of this bucket is currently open, if any. */
function openSpan(live: AttendanceEvent[], bucket: EventStep["bucket"]): boolean {
  let open = false;
  for (const event of live) {
    if (event.bucket !== bucket) continue;
    open = event.opens;
  }
  return open;
}

/**
 * What can sensibly happen next.
 *
 * "Sensibly", not "legally": nothing upstream enforces an order, and the
 * coordinator has to be able to record a visit that went oddly or that they
 * learned about backwards. So this only ever HIDES a button that would be
 * meaningless — offering "Back from break" when nobody went on one — and never
 * blocks a correction. Anything hidden is still reachable by editing an event.
 *
 * THE CHANGE FROM THE OLD MODEL: an already-used span no longer disqualifies
 * its opener. A second break is offered as readily as the first, because a
 * session can now hold both.
 */
export function nextEventKinds(events: AttendanceEvent[]): EventStep[] {
  const live = liveEvents(events);

  if (live.length === 0) {
    // The only thing that starts a segment.
    return [EVENT_STEPS.clock_in];
  }

  const out: EventStep[] = [];
  const closed = live.some((e) => e.kind === "clock_out");

  // Spelt out rather than built from the bucket name: a template literal here
  // is one typo away from indexing nothing, and TypeScript cannot see it.
  const REPEATABLE = [
    { bucket: "travel", open: EVENT_STEPS.travel_start, close: EVENT_STEPS.travel_end },
    { bucket: "parts_run", open: EVENT_STEPS.parts_run_start, close: EVENT_STEPS.parts_run_end },
    { bucket: "break", open: EVENT_STEPS.break_start, close: EVENT_STEPS.break_end },
  ] as const;

  for (const { bucket, open, close } of REPEATABLE) {
    out.push(openSpan(live, bucket) ? close : open);
  }

  // A closed session offers a fresh clock-in, which the server turns into a
  // NEW session: coming back to a store later is a second visit.
  out.push(closed ? EVENT_STEPS.clock_in : EVENT_STEPS.clock_out);

  return out;
}

/** `YYYY-MM-DDTHH:mm` for right now, in LOCAL time.
 *
 *  Local, not ISO: the pickers hold an offset-free local string, and
 *  toISOString() would stamp UTC — which reads as the wrong time to everyone
 *  looking at the screen, and would be sent as that wrong time too. */
export function nowForInput(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Minutes between two timestamps, or null when either is missing or the pair
 *  is inverted. Inverted is not an error here — upstream reports it as a
 *  warning and counts it as zero — so we mirror that and show nothing. */
export function spanMinutes(from: string | undefined, to: string | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.round((b - a) / 60000);
  return diff > 0 ? diff : null;
}

/** "1h 10m", "40m", "2h". Never "0m" — a zero span is not worth a line. */
export function formatSpan(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * How long the span closed by this event was.
 *
 * Walks back for the matching opener of the same bucket, so a session with two
 * breaks reports each one's own length rather than measuring both from the
 * first. Returns null on an opening event, or a close with nothing open.
 */
export function spanClosedBy(events: AttendanceEvent[], event: AttendanceEvent): number | null {
  if (event.opens) return null;

  const live = liveEvents(events);
  const index = live.findIndex((e) => e.id === event.id);
  if (index < 0) return null;

  for (let i = index - 1; i >= 0; i--) {
    const candidate = live[i];
    if (candidate.bucket !== event.bucket) continue;
    // A closer before an opener means that span was already accounted for.
    return candidate.opens ? spanMinutes(candidate.at, event.at) : null;
  }

  return null;
}
