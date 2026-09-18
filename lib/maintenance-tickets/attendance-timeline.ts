/**
 * Attendance as a story, not a form.
 *
 * The data model is unchanged -- eight nullable timestamps on one entry -- but
 * the way a coordinator arrives at them is not a form-filling exercise. It is a
 * running commentary, usually with the technician on the phone:
 *
 *   "he clocked in, and we start a travel time from when he gets out of his
 *    house till he gets to the store he will be working on, he arrived we
 *    finish the travel time, he worked and inspected, he went to get items, he
 *    came back, he went on a break, he ended the break"
 *
 * Showing all eight fields at once turns that into data entry and, in the words
 * of the person who built the system, confuses everyone including him. So this
 * module answers two questions instead: what has happened so far, and what can
 * sensibly happen next.
 *
 * WHAT A CLOCK WINDOW MEANS (confirmed with the author, and consistent with
 * AttendanceEntry::durations() upstream): one window is ONE PAID SEGMENT
 * ATTRIBUTABLE TO ONE STORE, not a working day. Clock-out at store A IS
 * clock-in at store B. The drive to a store belongs to that store's segment;
 * the drive home belongs to the last one. Coming back to store A later is a new
 * segment, treated exactly like arriving somewhere new.
 *
 * Travel and parts-run are PAID; break is NOT. Upstream computes work as the
 * clock window minus break, parts-run and travel, then pays work + travel +
 * parts-run -- so travel and parts-run come back out at full value and break
 * simply never counts.
 *
 * Pure: no React, no service calls.
 */

export type TimelineFieldKey =
  | "startClock"
  | "endClock"
  | "startTravel"
  | "endTravel"
  | "startBreak"
  | "endBreak"
  | "startPartsRun"
  | "endPartsRun";

export type TimelineValue = Record<TimelineFieldKey, string>;

export interface TimelineStep {
  key: TimelineFieldKey;
  /** What the coordinator would say out loud. */
  label: string;
  /** Does this stretch of time earn money? */
  paid: boolean;
  /** Opens a span, or closes one. */
  edge: "start" | "end";
  /** The other half of this pair. */
  pair: TimelineFieldKey;
}

export const TIMELINE_STEPS: Record<TimelineFieldKey, TimelineStep> = {
  startClock: { key: "startClock", label: "Clocked in", paid: true, edge: "start", pair: "endClock" },
  startTravel: { key: "startTravel", label: "Started driving", paid: true, edge: "start", pair: "endTravel" },
  endTravel: { key: "endTravel", label: "Arrived", paid: true, edge: "end", pair: "startTravel" },
  startPartsRun: { key: "startPartsRun", label: "Left to get parts", paid: true, edge: "start", pair: "endPartsRun" },
  endPartsRun: { key: "endPartsRun", label: "Back with parts", paid: true, edge: "end", pair: "startPartsRun" },
  startBreak: { key: "startBreak", label: "Went on break", paid: false, edge: "start", pair: "endBreak" },
  endBreak: { key: "endBreak", label: "Back from break", paid: false, edge: "end", pair: "startBreak" },
  endClock: { key: "endClock", label: "Clocked out", paid: true, edge: "end", pair: "startClock" },
};

export interface RecordedEvent {
  step: TimelineStep;
  /** Local `YYYY-MM-DDTHH:mm`, exactly as the picker holds it. */
  at: string;
}

/**
 * What has been recorded, in the order it happened.
 *
 * Sorted by the recorded time rather than by field order, because reality does
 * not arrive in field order -- a coordinator catching up on a visit may enter
 * the clock-out before remembering the break.
 *
 * Entries with no time are simply absent: an empty field is not an event, and
 * rendering eight empty rows is the thing we are getting away from.
 */
export function recordedEvents(value: Partial<TimelineValue>): RecordedEvent[] {
  const out: RecordedEvent[] = [];
  for (const key of Object.keys(TIMELINE_STEPS) as TimelineFieldKey[]) {
    const at = value[key];
    if (at) out.push({ step: TIMELINE_STEPS[key], at });
  }
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * What can sensibly happen next.
 *
 * "Sensibly", not "legally": upstream enforces no ordering at all, and the
 * coordinator has to be able to record a visit that went in an odd order or
 * that they learned about backwards. So this only ever HIDES a button that
 * would be meaningless -- offering "Back from break" when nobody went on one --
 * and never blocks a correction. Anything hidden here is still reachable by
 * editing the event directly.
 */
export function nextSteps(value: Partial<TimelineValue>): TimelineStep[] {
  const has = (k: TimelineFieldKey) => Boolean(value[k]);
  const out: TimelineStep[] = [];

  // Nothing at all yet: the only thing that starts a segment.
  if (!has("startClock")) {
    return [TIMELINE_STEPS.startClock];
  }

  // Open spans want closing before the same kind can open again.
  const openTravel = has("startTravel") && !has("endTravel");
  const openParts = has("startPartsRun") && !has("endPartsRun");
  const openBreak = has("startBreak") && !has("endBreak");

  if (openTravel) out.push(TIMELINE_STEPS.endTravel);
  else if (!has("startTravel")) out.push(TIMELINE_STEPS.startTravel);

  if (openParts) out.push(TIMELINE_STEPS.endPartsRun);
  else if (!has("startPartsRun")) out.push(TIMELINE_STEPS.startPartsRun);

  if (openBreak) out.push(TIMELINE_STEPS.endBreak);
  else if (!has("startBreak")) out.push(TIMELINE_STEPS.startBreak);

  if (!has("endClock")) out.push(TIMELINE_STEPS.endClock);

  return out;
}

/** True once the segment is closed -- nothing more can be added to it. */
export function isClosed(value: Partial<TimelineValue>): boolean {
  return Boolean(value.startClock && value.endClock);
}

/** True while somebody is on the clock with no clock-out yet. */
export function isOnTheClock(value: Partial<TimelineValue>): boolean {
  return Boolean(value.startClock && !value.endClock);
}

/** `YYYY-MM-DDTHH:mm` for right now, in LOCAL time.
 *
 *  Local, not ISO: the pickers hold an offset-free local string, and
 *  toISOString() would stamp UTC, which reads as the wrong time to everyone
 *  looking at the screen and would be sent as that wrong time too. */
export function nowForInput(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Minutes between two local input strings, or null when either is missing or
 *  the pair is inverted. Inverted is not an error here -- upstream reports it
 *  as a warning and counts it as zero -- so we mirror that and show nothing. */
export function spanMinutes(
  from: string | undefined,
  to: string | undefined
): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Math.round((b - a) / 60000);
  return diff > 0 ? diff : null;
}

/** "1h 10m", "40m", "2h". Never "0m" -- a zero span is not worth a line. */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * The handoff: leaving this store for another one.
 *
 * Stamps the same instant as this segment's clock-out and the next segment's
 * clock-in and travel start, because that is what the author described -- the
 * segments are contiguous, and the drive belongs to where he is going, not
 * where he has been.
 *
 * Returns both halves so the caller can show exactly what it is about to write.
 * Nothing here is silent: every stamp it produces is editable afterwards.
 */
export function handoffAt(now: string = nowForInput()): {
  closeCurrent: Partial<TimelineValue>;
  openNext: Partial<TimelineValue>;
} {
  return {
    closeCurrent: { endClock: now },
    openNext: { startClock: now, startTravel: now },
  };
}
