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
    if (linked.status === "absent") continue; // no-show — excluded
    merged.push({
      ...shift,
      // Identity and sync state stay with the planned shift; times, label and
      // duration come from what actually happened.
      startTime: linked.startTime,
      endTime: linked.endTime,
      durationMinutes: linked.durationMinutes,
      label: linked.label,
      type: linked.type,
      note: linked.note ?? shift.note,
    });
  }

  for (const a of actual) {
    if (a.status === "added" && !a.plannedShiftId) {
      merged.push({
        id: a.id,
        // Ad-hoc coverage has no planned shift behind it, so there is no
        // Humanity shift id to carry.
        shiftId: a.id,
        employeeId: a.employeeId,
        dayIndex: a.dayIndex,
        shiftDate: a.shiftDate,
        startTime: a.startTime,
        endTime: a.endTime,
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
