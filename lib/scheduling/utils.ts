import type {
  Shift,
  ShiftConflict,
  AvailabilityRule,
  TimeOffEntry,
} from "@/types/scheduling.types";
import { calcHours } from "./data";

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
            shiftA: cell[i],
            shiftB: cell[j],
            employeeId: cell[i].employeeId,
            dayIndex: cell[i].dayIndex,
          });
        }
      }
    }
  }
  return conflicts;
}

/** Get the set of shift IDs that are in conflict */
export function conflictedShiftIds(conflicts: ShiftConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.shiftA.id);
    ids.add(c.shiftB.id);
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
    map[s.employeeId] = (map[s.employeeId] ?? 0) + calcHours(s.startTime, s.endTime);
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

/** Generate recurring shift copies for N future weeks. Returns new shifts keyed by weekOffset */
export function generateRecurringShifts(
  sourceShifts: Shift[],
  weeksAhead: number,
  currentWeekOffset: number
): Record<number, Shift[]> {
  const recurring = sourceShifts.filter((s) => s.isRecurring);
  const result: Record<number, Shift[]> = {};
  for (let w = 1; w <= weeksAhead; w++) {
    const offset = currentWeekOffset + w;
    result[offset] = recurring.map((s) => ({
      ...s,
      id: `shift-${Date.now()}-${w}-${Math.random().toString(36).slice(2, 7)}`,
    }));
  }
  return result;
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
      map[s.dayIndex].hours += calcHours(s.startTime, s.endTime);
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
