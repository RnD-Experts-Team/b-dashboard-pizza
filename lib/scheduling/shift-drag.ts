/**
 * Moving or copying a shift by dragging it onto another cell of the planned grid.
 *
 * A plain drag MOVES the shift; Ctrl (or ⌘) held at the drop COPIES it.
 *
 * Only the TIME and the LABEL travel to the new place. `type` goes with the
 * label (every draft must carry one, and a moved "Evening" that arrived as
 * "custom" would be saved differently from the shift it came from). The note and
 * the recurring flag stay behind on purpose: a note is usually about one person
 * on one day. (A draft that is merely moved keeps its own note — nothing about it
 * is recreated.)
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

/** What is being dragged: a shift already saved on the server, or an unsaved draft. */
export type ShiftOrigin =
  | {
      kind: "saved";
      /** The assignment id — what the card carries. */
      id: string;
      /** The SHIFT id — what the delete endpoint addresses. */
      shiftId: string;
    }
  | { kind: "draft"; draftId: string };

/** What is picked up: the shift's time and label, and the cell it came from. */
export interface ShiftDragSource {
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  /** The cell it was picked up from, so dropping it back there does nothing. */
  fromEmployeeId: string;
  fromDayIndex: number;
  origin: ShiftOrigin;
}

/** Where it is put down. */
export interface ShiftDropTarget {
  employeeId: string;
  dayIndex: number;
}

/**
 * The unsaved shift that stands in for a copy, or for a moved SAVED shift.
 * Time and label only; no note, not recurring.
 */
export function draftFromSource(
  source: ShiftDragSource,
  target: ShiftDropTarget,
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

/** Dropping a shift back on the cell it came from would change nothing. */
export function isSameCell(
  source: ShiftDragSource,
  target: ShiftDropTarget,
): boolean {
  return (
    source.fromEmployeeId === target.employeeId &&
    source.fromDayIndex === target.dayIndex
  );
}

/**
 * Whether a shift can land on a person's day, and what to say if it is dubious.
 *
 * `blocked` is a warning only — the move or copy still happens, the same way
 * adding a shift over a block is allowed. `unsynced` is the one hard no: the
 * person can't be scheduled yet (the grid's own "+" button is disabled for
 * them), and a draft for them would only fail when saved.
 */
export type DropTargetCheck =
  | { status: "ok" }
  | { status: "blocked"; reason: string }
  | { status: "unsynced"; reason: string };

export function checkDropTarget(
  employee: Pick<ScheduleEmployee, "id" | "name" | "synced">,
  dayIndex: number,
  startTime: string,
  endTime: string,
  availability: AvailabilityRule[],
  timeOff: TimeOffEntry[],
): DropTargetCheck {
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
