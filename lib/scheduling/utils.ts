import type {
  Shift,
  ShiftConflict,
  AvailabilityRule,
  TimeOffEntry,
  ActualShift,
} from "@/types/scheduling.types";

/** Convert "HH:mm" to total minutes from midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Normalise end minutes to handle midnight wrap */
function normaliseRange(start: string, end: string): [number, number] {
  let s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 24 * 60;
  return [s, e];
}

/**
 * Signed minutes from one clock time to another, by the shorter way round.
 *
 * Plain subtraction breaks at midnight: 23:55 against a 00:00 plan reads as
 * 1435 minutes late rather than 5 minutes early. Wrapping into ±12h gives the
 * reading a person would give.
 */
function signedOffsetMinutes(from: string, to: string): number {
  const raw = (toMinutes(to) - toMinutes(from) + 1440) % 1440;
  return raw > 720 ? raw - 1440 : raw;
}

/**
 * How far each end of a recorded shift sits from the planned one.
 *
 * Negative is early, positive is late — for both edges, so "in −4, out +6"
 * reads as a slightly long shift without the reader having to flip a sign.
 */
export function shiftEdgeOffsets(
  planned: { startTime: string; endTime: string },
  actual: { startTime: string; endTime: string | null },
): { start: number; end: number | null } {
  return {
    start: signedOffsetMinutes(planned.startTime, actual.startTime),
    // No end punch yet, so there is no offset to give — not "on time", and not
    // zero either, both of which would read as a finished shift.
    end:
      actual.endTime === null
        ? null
        : signedOffsetMinutes(planned.endTime, actual.endTime),
  };
}

/**
 * "+20m" / "−1h 05m", or null when the durations match exactly.
 *
 * One formatter for every place a worked duration gets compared to a planned
 * one — the comparison card, the grouped clock-in card, and the actual-shift
 * card all showed this figure with their own copy of the same function before
 * this, and they had already started to drift in the rounding.
 */
export function formatDurationDelta(
  plannedMinutes: number,
  actualMinutes: number,
): string | null {
  const diff = actualMinutes - plannedMinutes;
  if (diff === 0) return null;
  return (diff > 0 ? "+" : "−") + formatMinutes(Math.abs(diff));
}

/** "20m" / "1h 05m". The unsigned half of `formatDurationDelta`. */
export function formatMinutes(total: number): string {
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Time between one segment's clock-out and the next one's clock-in.
 *
 * Off the clock and therefore unpaid, which is why a shift's duration is the
 * sum of its segments rather than first-in to last-out. Surfaced so a card can
 * say where the missing time went instead of leaving the reader to subtract.
 */
export function offClockMinutes(
  segments: { timeIn: string; timeOut: string | null }[],
): number {
  let total = 0;
  for (let i = 1; i < segments.length; i++) {
    const prevOut = segments[i - 1].timeOut;
    if (!prevOut) continue;
    // Slice the clock out of "YYYY-MM-DD HH:MM:SS" — never parse it as a date.
    let gap =
      toMinutes(segments[i].timeIn.slice(11, 16)) -
      toMinutes(prevOut.slice(11, 16));
    if (gap < 0) gap += 1440; // the pair straddles midnight
    total += gap;
  }
  return total;
}

/** Check if two time ranges overlap */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const [a0, a1] = normaliseRange(aStart, aEnd);
  const [b0, b1] = normaliseRange(bStart, bEnd);
  return a0 < b1 && b0 < a1;
}

/**
 * Flatten conflict rows into the set of conflicting ASSIGNMENT ids.
 *
 * Consumes the server's `conflicts` array directly. Conflict detection itself
 * is server-side: it compares UTC instants, so it catches an overnight
 * collision that wall-clock comparison would miss.
 */
export function conflictedShiftIds(conflicts: ShiftConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.shiftAId);
    ids.add(c.shiftBId);
  }
  return ids;
}

/**
 * ADVISORY pre-flight check for the add/edit dialog.
 *
 * The SERVER is authoritative for conflicts — it compares UTC instants and so
 * catches an overnight collision (22:00-02:00 against the next morning's
 * 01:00-09:00) that this wall-clock check misses, and it answers with a 409 the
 * manager can override. This exists only to warn while the user is still
 * typing, when no request has been made yet. Never treat it as the decision.
 */
export function wouldConflict(
  newStart: string,
  newEnd: string,
  employeeId: string,
  dayIndex: number,
  existingShifts: Shift[],
  excludeId?: string
): boolean {
  return existingShifts.some(
    (s) =>
      s.employeeId === employeeId &&
      s.dayIndex === dayIndex &&
      s.id !== excludeId &&
      timesOverlap(newStart, newEnd, s.startTime, s.endTime)
  );
}

/**
 * ADVISORY availability check for the add/edit dialog, same caveat as
 * `wouldConflict`: the server enforces this and returns EMPLOYEE_UNAVAILABLE.
 */
export function isBlockedByAvailability(
  employeeId: string,
  dayIndex: number,
  startTime: string,
  endTime: string,
  rules: AvailabilityRule[]
): AvailabilityRule | undefined {
  return rules.find(
    (r) =>
      r.employeeId === employeeId &&
      r.dayIndex === dayIndex &&
      (r.allDay ||
        (r.startTime &&
          r.endTime &&
          timesOverlap(startTime, endTime, r.startTime, r.endTime)))
  );
}

/**
 * ADVISORY time-off check for the add/edit dialog, same caveat as
 * `wouldConflict`: the server enforces this and returns EMPLOYEE_ON_TIME_OFF.
 */
export function hasTimeOff(
  employeeId: string,
  dayIndex: number,
  entries: TimeOffEntry[]
): TimeOffEntry | undefined {
  return entries.find(
    (e) => e.employeeId === employeeId && e.dayIndex === dayIndex
  );
}

/**
 * Pair timeclock clock-ins with the planned shift they belong to.
 *
 * The backend sends a clock-in with `planned_shift_id: null` and
 * `status: "added"` — it makes no connection to that day's planned shift. Taken
 * literally that puts two unrelated cards in one cell: a "Pending review" ghost
 * for the plan, and an "Added coverage" card for the punch captioned "not in the
 * original plan", which is false when the shift plainly WAS planned.
 *
 * So the pairing is inferred here. Two rules, both deliberately conservative,
 * because a confident wrong pairing is worse than none:
 *
 *   Only `source === "timeclock"` pairs. A `manual` entry with no planned shift
 *   is coverage somebody typed in on purpose — genuinely extra, even on a day
 *   the employee was also scheduled.
 *
 *   Only when the cell holds exactly ONE planned shift. Every clock-in in that
 *   cell then attaches to it, which is what a lunch break looks like: one shift,
 *   two punches. With two or more planned shifts there is no honest way to tell
 *   which punch belongs to which, so nothing groups and the cell renders as it
 *   did before.
 *
 * Presentation only — `mergeActualShifts` still counts the clock-in and still
 * excludes the unreviewed plan, so hours are unaffected.
 */
export interface TimeclockGroup {
  plannedShift: Shift;
  clockIns: ActualShift[];
}

export function groupClockInsByPlan(
  cellShifts: Shift[],
  cellAddedActuals: ActualShift[],
  allActuals: ActualShift[],
): {
  groups: TimeclockGroup[];
  looseShifts: Shift[];
  looseActuals: ActualShift[];
} {
  const clockIns = cellAddedActuals.filter((a) => a.source === "timeclock");
  const plan = cellShifts.length === 1 ? cellShifts[0] : undefined;

  /**
   * A plan that already has a linked actual is settled — somebody reviewed it.
   * Grouping it would drop that reviewed record from the cell entirely (the
   * plan gets consumed by the group and its `ActualShiftCard` never renders),
   * leaving the plan's times and a stray punch on screen instead of what was
   * actually recorded. Only unreviewed plans are candidates.
   */
  const isUnreviewed = plan && !actualForPlanned(plan.id, allActuals);

  if (!plan || !isUnreviewed || clockIns.length === 0) {
    return { groups: [], looseShifts: cellShifts, looseActuals: cellAddedActuals };
  }

  const clockInIds = new Set(clockIns.map((a) => a.id));
  return {
    groups: [{ plannedShift: plan, clockIns }],
    looseShifts: [],
    looseActuals: cellAddedActuals.filter((a) => !clockInIds.has(a.id)),
  };
}

/** Find the ActualShift linked to a given planned shift id, if reviewed */
export function actualForPlanned(
  shiftId: string,
  actual: ActualShift[]
): ActualShift | undefined {
  return actual.find((a) => a.plannedShiftId === shiftId);
}

/**
 * Merge planned + actual shifts into a single reviewed-only "what really happened" list.
 * - Linked confirmed/modified actuals replace the planned shift's time/label/type.
 * - Linked absent actuals drop the planned shift entirely (no-show).
 * - Planned shifts with no linked actual yet (still pending review) are excluded —
 *   totals only reflect shifts a manager has explicitly reviewed.
 * - Standalone "added" actuals (ad-hoc coverage, no plannedShiftId) are appended as-is.
 * Result is Shift-shaped so it renders through the same grid components as the
 * plan. Note the server's `stats`, `conflicts` and overtime describe the PLAN,
 * so they are not shown against this merged view.
 */
export function mergeActualShifts(planned: Shift[], actual: ActualShift[]): Shift[] {
  const merged: Shift[] = [];

  for (const shift of planned) {
    const linked = actualForPlanned(shift.id, actual);
    if (!linked) continue; // pending review — excluded
    if (linked.reviewState === "absent") continue; // no-show — excluded
    merged.push({
      ...shift,
      // Identity and sync state stay with the planned shift; times, label and
      // duration come from what actually happened.
      startTime: linked.startTime,
      /**
       * A running shift has no end yet. The plan's own end stands in purely so
       * the row has a time to lay out against — nothing reads it as a record of
       * when they left, and the hours below come from `durationMinutes`, which
       * the server keeps correct as the shift grows.
       */
      endTime: linked.endTime ?? shift.endTime,
      isOpen: linked.isOpen,
      durationMinutes: linked.durationMinutes,
      label: linked.label,
      type: linked.type,
      note: linked.note ?? shift.note,
    });
  }

  for (const a of actual) {
    // No link to a plan IS what makes it ad-hoc coverage — the server says the
    // same thing again in `timeVariance: "unplanned"`, but the link is the
    // field that actually decides where the card belongs.
    if (!a.plannedShiftId) {
      merged.push({
        id: a.id,
        // Ad-hoc coverage has no planned shift behind it, so there is no
        // Humanity shift id to carry.
        shiftId: a.id,
        employeeId: a.employeeId,
        dayIndex: a.dayIndex,
        shiftDate: a.shiftDate,
        startTime: a.startTime,
        // Placeholder for a shift still running — see the note above.
        endTime: a.endTime ?? a.startTime,
        isOpen: a.isOpen,
        durationMinutes: a.durationMinutes,
        label: a.label,
        type: a.type,
        note: a.note,
        isPublished: false,
        syncStatus: "synced",
        origin: "operations",
      });
    }
  }

  return merged;
}
