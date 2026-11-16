/**
 * Copying a shift by dragging it onto another cell of the planned grid.
 *
 * Only the TIME and the LABEL travel. `type` goes with the label (every draft
 * must carry one, and a copied "Evening" that arrived as "custom" would be
 * saved differently from the shift it was copied from). The note and the
 * recurring flag stay behind on purpose: a note is usually about one person on
 * one day.
 *
 * Pure and dependency-light, so the grid (which draws the warning on the card),
 * the manager (which creates the draft and toasts) and any preview all use the
 * same answers and cannot disagree.
 */

import type {
  AvailabilityRule,
  ScheduleEmployee,
  ShiftType,
  TimeOffEntry,
} from "@/types/scheduling.types";
import type { DraftShift } from "./draft.store";
import { hasTimeOff, isBlockedByAvailability } from "./utils";

/** What is picked up: the shift's time and label, and the cell it came from. */
export interface ShiftCopySource {
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  /** The cell it was picked up from, so dropping it back there does nothing. */
  fromEmployeeId: string;
  fromDayIndex: number;
}

/** Where it is put down. */
export interface ShiftCopyTarget {
  employeeId: string;
  dayIndex: number;
}

/** The unsaved shift a copy becomes. Time and label only; no note, not recurring. */
export function draftFromCopy(
  source: ShiftCopySource,
  target: ShiftCopyTarget,
): Omit<DraftShift, "draftId"> {
  return {
    employeeId: target.employeeId,
    dayIndex: target.dayIndex,
    startTime: source.startTime,
    endTime: source.endTime,
    label: source.label,
    type: source.type,
  };
}

/** Dropping a shift back on the cell it came from would only make a duplicate. */
export function isSameCell(source: ShiftCopySource, target: ShiftCopyTarget): boolean {
  return (
    source.fromEmployeeId === target.employeeId &&
    source.fromDayIndex === target.dayIndex
  );
}

/**
 * Whether a copy can land on a person's day, and what to say if it is dubious.
 *
 * `blocked` is a warning only — the copy is still made, the same way adding a
 * shift over a block is allowed. `unsynced` is the one hard no: the person
 * can't be scheduled yet (the grid's own "+" button is disabled for them), and
 * a draft for them would only fail when saved.
 */
export type CopyTargetCheck =
  | { status: "ok" }
  | { status: "blocked"; reason: string }
  | { status: "unsynced"; reason: string };

export function checkCopyTarget(
  employee: Pick<ScheduleEmployee, "id" | "name" | "synced">,
  dayIndex: number,
  startTime: string,
  endTime: string,
  availability: AvailabilityRule[],
  timeOff: TimeOffEntry[],
): CopyTargetCheck {
  if (!employee.synced) {
    return {
      status: "unsynced",
      reason: `${employee.name} is still being set up and can't be scheduled yet`,
    };
  }
  const reason = blockReasonFor(
    employee,
    dayIndex,
    startTime,
    endTime,
    availability,
    timeOff,
  );
  return reason ? { status: "blocked", reason } : { status: "ok" };
}

/**
 * Why a shift at this time clashes with what the employee has said about that
 * day, or null.
 *
 * ADVISORY, like the checks it is built on: the server enforces availability
 * and leave and answers with a refusal the manager may override. The grid uses
 * this to mark a card and the drop uses it to warn, so the two always agree.
 *
 * Computed per shift, not per day, so a partial block ("not before 17:00")
 * only flags the shifts that actually overlap it.
 */
export function blockReasonFor(
  employee: Pick<ScheduleEmployee, "id" | "name">,
  dayIndex: number,
  startTime: string,
  endTime: string,
  availability: AvailabilityRule[],
  timeOff: TimeOffEntry[],
): string | null {
  const off = hasTimeOff(employee.id, dayIndex, timeOff);
  if (off) return `${employee.name} is on ${off.label} this day`;
  const rule = isBlockedByAvailability(
    employee.id,
    dayIndex,
    startTime,
    endTime,
    availability,
  );
  if (!rule) return null;
  return rule.reason
    ? `${employee.name} is unavailable: ${rule.reason}`
    : `${employee.name} is marked unavailable at this time`;
}
