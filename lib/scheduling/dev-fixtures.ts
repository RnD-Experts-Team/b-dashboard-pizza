/**
 * TEMPORARY mock records for the scheduling feature.
 *
 * DELETE THIS FILE once `use-schedule-week` is wired to the OperationsPizza API
 * (Stage C1). It exists only so the grid, dialogs and the new UI surfaces built
 * in Stage A remain reviewable before any endpoint exists. Nothing here should
 * survive into production.
 *
 * Every export below is replaced by real API data:
 *   DUMMY_EMPLOYEES        -> week payload `employees`
 *   INITIAL_SHIFTS         -> week payload `shifts`
 *   PREVIOUS_WEEK_SHIFTS   -> a second week fetch / bulk copy-week
 *   INITIAL_ACTUAL_SHIFTS  -> week payload `actual_shifts`
 *   INITIAL_AVAILABILITY   -> week payload `availability`
 *   INITIAL_TIME_OFF       -> week payload `time_off`
 *   DEPARTMENTS            -> GET /schedule/departments
 *
 * The seed helpers below fill in the fields the server owns (`shiftId`,
 * `shiftDate`, `durationMinutes`, `syncStatus`, `origin`, ...) so the literal
 * data stays readable. `calcHours` is used for the mock durations, which is
 * fine here precisely because none of this is real payroll data.
 */

import type {
  ActualShift,
  ActualShiftStatus,
  AvailabilityRule,
  ScheduleEmployee,
  Shift,
  ShiftOrigin,
  ShiftSyncStatus,
  ShiftType,
  TimeOffEntry,
  TimeOffType,
} from "@/types/scheduling.types";
import { calcHours } from "./constants";
import {
  DEFAULT_WEEK_START_DOW,
  shiftIsoDate,
  snapToWeekStart,
  todayIso,
} from "./week";

const THIS_WEEK = snapToWeekStart(todayIso(), DEFAULT_WEEK_START_DOW);
const PREVIOUS_WEEK = shiftIsoDate(THIS_WEEK, -7);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Seed helpers                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

interface ShiftSeed {
  id: string;
  employeeId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  /** Defaults to "synced". Set to exercise the sync badges. */
  syncStatus?: ShiftSyncStatus;
  origin?: ShiftOrigin;
  isPublished?: boolean;
  note?: string;
}

function seedShift(weekStart: string, seed: ShiftSeed): Shift {
  const syncStatus = seed.syncStatus ?? "synced";
  return {
    id: seed.id,
    shiftId: `s-${seed.id}`,
    employeeId: seed.employeeId,
    dayIndex: seed.dayIndex,
    shiftDate: shiftIsoDate(weekStart, seed.dayIndex),
    startTime: seed.startTime,
    endTime: seed.endTime,
    durationMinutes: Math.round(calcHours(seed.startTime, seed.endTime) * 60),
    crossesMidnight: seed.endTime <= seed.startTime,
    label: seed.label,
    type: seed.type,
    note: seed.note,
    isPublished: seed.isPublished ?? false,
    syncStatus,
    origin: seed.origin ?? "operations",
    humanityShiftId: syncStatus === "synced" ? `h-${seed.id}` : null,
  };
}

interface ActualSeed {
  id: string;
  employeeId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  status: ActualShiftStatus;
  plannedShiftId?: string;
  note?: string;
}

function seedActual(weekStart: string, seed: ActualSeed): ActualShift {
  return {
    ...seed,
    shiftDate: shiftIsoDate(weekStart, seed.dayIndex),
    durationMinutes: Math.round(calcHours(seed.startTime, seed.endTime) * 60),
    source: "manual",
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Roster                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * `emp-8` is deliberately left unsynced so the "cannot be scheduled yet"
 * affordances can be reviewed before the API exists.
 */
export const DUMMY_EMPLOYEES: ScheduleEmployee[] = [
  { id: "emp-1", name: "Marco Rossi", role: "Pizzaiolo", department: "Kitchen", avatar: "MR", color: "blue", isActive: true, synced: true, hourlyRate: 16.5 },
  { id: "emp-2", name: "Sofia Kim", role: "Cashier", department: "Front of House", avatar: "SK", color: "emerald", isActive: true, synced: true, hourlyRate: 15 },
  { id: "emp-3", name: "Leo Jenkins", role: "Head Chef", department: "Kitchen", avatar: "LJ", color: "violet", isActive: true, synced: true, hourlyRate: 22 },
  { id: "emp-4", name: "Elena Patel", role: "Prep Cook", department: "Kitchen", avatar: "EP", color: "amber", isActive: true, synced: true, hourlyRate: 15.5 },
  { id: "emp-5", name: "David Chen", role: "Delivery Driver", department: "Delivery", avatar: "DC", color: "rose", isActive: true, synced: true, hourlyRate: 14 },
  { id: "emp-6", name: "Maria Rodriguez", role: "Server", department: "Front of House", avatar: "MR", color: "cyan", isActive: true, synced: true, hourlyRate: 15 },
  { id: "emp-7", name: "James Carter", role: "Line Cook", department: "Kitchen", avatar: "JC", color: "orange", isActive: true, synced: true, hourlyRate: 16 },
  { id: "emp-8", name: "Aisha Noor", role: "Delivery Driver", department: "Delivery", avatar: "AN", color: "pink", isActive: true, synced: false, hourlyRate: 14 },
  { id: "emp-9", name: "Tyler Brooks", role: "Manager", department: "Management", avatar: "TB", color: "indigo", isActive: true, synced: true, hourlyRate: 28 },
  { id: "emp-10", name: "Nina Patel", role: "Hostess", department: "Front of House", avatar: "NP", color: "teal", isActive: true, synced: true, hourlyRate: 14.5 },
];

/** Hardcoded department filter list — replaced by the API's mapped Humanity positions. */
export const DEPARTMENTS = ["All", "Kitchen", "Front of House", "Delivery", "Management"] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Planned shifts                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * `shift-12` is `pending` and `shift-13` is `parked` on purpose: a
 * partially-throttled write leaves the earliest days synced and the last days
 * pending, and both states must render as real saved shifts, not errors.
 * `shift-15` came from Humanity's own app.
 */
export const INITIAL_SHIFTS: Shift[] = [
  { id: "shift-1", employeeId: "emp-1", dayIndex: 0, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-2", employeeId: "emp-1", dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-3", employeeId: "emp-2", dayIndex: 1, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-4", employeeId: "emp-3", dayIndex: 0, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-5", employeeId: "emp-3", dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-6", employeeId: "emp-4", dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-7", employeeId: "emp-4", dayIndex: 4, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-8", employeeId: "emp-5", dayIndex: 0, startTime: "10:00", endTime: "14:00", label: "Split AM", type: "split" },
  { id: "shift-9", employeeId: "emp-5", dayIndex: 0, startTime: "17:00", endTime: "21:00", label: "Split PM", type: "split" },
  { id: "shift-10", employeeId: "emp-6", dayIndex: 2, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "shift-11", employeeId: "emp-6", dayIndex: 5, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-12", employeeId: "emp-7", dayIndex: 3, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning", syncStatus: "pending" },
  { id: "shift-13", employeeId: "emp-8", dayIndex: 4, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening", syncStatus: "parked" },
  { id: "shift-14", employeeId: "emp-9", dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "shift-15", employeeId: "emp-10", dayIndex: 6, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening", origin: "humanity" },
].map((seed) => seedShift(THIS_WEEK, seed as ShiftSeed));

/**
 * Pre-seeded schedule for the previous week, so "Copy Previous Week" works out
 * of the box.
 */
export const PREVIOUS_WEEK_SHIFTS: Shift[] = [
  { id: "pw-1", employeeId: "emp-1", dayIndex: 0, startTime: "10:00", endTime: "18:00", label: "Morning", type: "morning" },
  { id: "pw-2", employeeId: "emp-1", dayIndex: 4, startTime: "10:00", endTime: "18:00", label: "Morning", type: "morning" },
  { id: "pw-3", employeeId: "emp-2", dayIndex: 0, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "pw-4", employeeId: "emp-2", dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "pw-5", employeeId: "emp-3", dayIndex: 1, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "pw-6", employeeId: "emp-3", dayIndex: 5, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "pw-7", employeeId: "emp-4", dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "pw-8", employeeId: "emp-5", dayIndex: 1, startTime: "10:00", endTime: "14:00", label: "Split AM", type: "split" },
  { id: "pw-9", employeeId: "emp-5", dayIndex: 1, startTime: "17:00", endTime: "21:00", label: "Split PM", type: "split" },
  { id: "pw-10", employeeId: "emp-6", dayIndex: 0, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "pw-11", employeeId: "emp-7", dayIndex: 2, startTime: "08:00", endTime: "16:00", label: "Morning", type: "morning" },
  { id: "pw-12", employeeId: "emp-8", dayIndex: 3, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
  { id: "pw-13", employeeId: "emp-9", dayIndex: 0, startTime: "09:00", endTime: "17:00", label: "Morning", type: "morning" },
  { id: "pw-14", employeeId: "emp-10", dayIndex: 5, startTime: "16:00", endTime: "22:00", label: "Evening", type: "evening" },
].map((seed) => seedShift(PREVIOUS_WEEK, seed as ShiftSeed));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Availability & time off                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * BLOCKED windows. `avail-1` / `avail-2` come from the employee's HiringPizza
 * profile and are read-only here; the rest are manager overrides and can be
 * deleted.
 */
export const INITIAL_AVAILABILITY: AvailabilityRule[] = [
  { id: "avail-1", employeeId: "emp-2", dayIndex: 4, allDay: true, reason: "Not available on Saturdays", source: "employee_profile" as const },
  { id: "avail-2", employeeId: "emp-5", dayIndex: 5, allDay: true, reason: "Unavailable Sundays", source: "employee_profile" as const },
  { id: "avail-3", employeeId: "emp-7", dayIndex: 6, allDay: false, startTime: "08:00", endTime: "12:00", reason: "Morning classes on Monday", source: "override" as const },
  { id: "avail-4", employeeId: "emp-3", dayIndex: 3, allDay: false, startTime: "18:00", endTime: "23:00", reason: "Family commitment Friday evenings", source: "override" as const },
].map((rule) => ({
  ...rule,
  date: shiftIsoDate(THIS_WEEK, rule.dayIndex),
}));

/**
 * `to-1` was approved in Humanity and cannot be withdrawn here; the others were
 * entered locally and can be deleted.
 */
export const INITIAL_TIME_OFF: TimeOffEntry[] = [
  { timeOffId: "12", employeeId: "emp-1", dayIndex: 3, type: "pto" as TimeOffType, label: "PTO", origin: "humanity" as const },
  { timeOffId: "13", employeeId: "emp-6", dayIndex: 4, type: "vacation" as TimeOffType, label: "Vacation", origin: "operations" as const },
  { timeOffId: "14", employeeId: "emp-9", dayIndex: 5, type: "sick" as TimeOffType, label: "Sick Day", origin: "operations" as const },
].map((entry) => ({
  ...entry,
  id: `${entry.timeOffId}-${entry.dayIndex}`,
  date: shiftIsoDate(THIS_WEEK, entry.dayIndex),
  status: "approved" as const,
}));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Actual shifts                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** One entry per review state: confirmed, modified, absent, and ad-hoc added. */
export const INITIAL_ACTUAL_SHIFTS: ActualShift[] = [
  {
    id: "actual-1",
    employeeId: "emp-1",
    dayIndex: 0,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "confirmed",
    plannedShiftId: "shift-1",
  },
  {
    id: "actual-2",
    employeeId: "emp-4",
    dayIndex: 1,
    startTime: "09:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "modified",
    plannedShiftId: "shift-6",
    note: "Clocked in an hour late",
  },
  {
    id: "actual-3",
    employeeId: "emp-6",
    dayIndex: 5,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "absent",
    plannedShiftId: "shift-11",
    note: "No call, no show",
  },
  {
    id: "actual-4",
    employeeId: "emp-7",
    dayIndex: 5,
    startTime: "08:00",
    endTime: "16:00",
    label: "Morning",
    type: "morning",
    status: "added",
    note: "Covered for Maria Rodriguez",
  },
].map((seed) => seedActual(THIS_WEEK, seed as ActualSeed));
