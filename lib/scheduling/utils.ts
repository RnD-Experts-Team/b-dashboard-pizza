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

/** Detect all pairwise shift conflicts in a set of shifts */
export function detectConflicts(shifts: Shift[]): ShiftConflict[] {
  const conflicts: ShiftConflict[] = [];
  const byEmpDay: Record<string, Shift[]> = {};

  for (const s of shifts) {
    const key = `${s.employeeId}-${s.dayIndex}`;
    if (!byEmpDay[key]) byEmpDay[key] = [];
    byEmpDay[key].push(s);
  }

  for (const cell of Object.values(byEmpDay)) {
    for (let i = 0; i < cell.length; i++) {
      for (let j = i + 1; j < cell.length; j++) {
        if (
          timesOverlap(
            cell[i].startTime,
            cell[i].endTime,
            cell[j].startTime,
            cell[j].endTime
          )
        ) {
          conflicts.push({
            employeeId: cell[i].employeeId,
            shiftAId: cell[i].id,
            shiftBId: cell[j].id,
            shiftDate: cell[i].shiftDate,
          });
        }
      }
    }
  }
  return conflicts;
}

/**
 * Flatten conflict rows into the set of conflicting ASSIGNMENT ids.
 *
 * Shaped to consume the server's `conflicts` array directly, so wiring C1 means
 * deleting `detectConflicts` and feeding the payload straight in here.
 */
export function conflictedShiftIds(conflicts: ShiftConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.shiftAId);
    ids.add(c.shiftBId);
  }
  return ids;
}

/** Check if a proposed shift conflicts with existing shifts */
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

/** Calculate weekly hours per employee → { empId: totalHours } */
export function weeklyHoursMap(shifts: Shift[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of shifts) {
    map[s.employeeId] = (map[s.employeeId] ?? 0) + s.durationMinutes / 60;
  }
  return map;
}

/** Employees exceeding overtime threshold */
export function overtimeEmployees(
  shifts: Shift[],
  threshold: number
): Set<string> {
  const hours = weeklyHoursMap(shifts);
  const over = new Set<string>();
  for (const [id, h] of Object.entries(hours)) {
    if (h > threshold) over.add(id);
  }
  return over;
}

/** Check if an employee is unavailable at a given day/time */
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

/** Check if employee has time-off on a given day */
export function hasTimeOff(
  employeeId: string,
  dayIndex: number,
  entries: TimeOffEntry[]
): TimeOffEntry | undefined {
  return entries.find(
    (e) => e.employeeId === employeeId && e.dayIndex === dayIndex
  );
}

/** Coverage per day: { dayIndex: { employeeCount, totalHours, shiftCount } } */
export function dailyCoverage(shifts: Shift[]): Record<
  number,
  { employeeCount: number; totalHours: number; shiftCount: number }
> {
  const map: Record<number, { emps: Set<string>; hours: number; count: number }> = {};
  for (let d = 0; d < 7; d++) {
    map[d] = { emps: new Set(), hours: 0, count: 0 };
  }
  for (const s of shifts) {
    if (s.dayIndex >= 0 && s.dayIndex < 7) {
      map[s.dayIndex].emps.add(s.employeeId);
      map[s.dayIndex].hours += s.durationMinutes / 60;
      map[s.dayIndex].count += 1;
    }
  }
  const result: Record<number, { employeeCount: number; totalHours: number; shiftCount: number }> = {};
  for (let d = 0; d < 7; d++) {
    result[d] = {
      employeeCount: map[d].emps.size,
      totalHours: map[d].hours,
      shiftCount: map[d].count,
    };
  }
  return result;
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
 * Result is Shift-shaped so it drops straight into detectConflicts/weeklyHoursMap/overtimeEmployees.
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
