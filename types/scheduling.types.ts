/**
 * Scheduling domain types.
 *
 * These mirror the OperationsPizza API (camelCased at the adapter boundary in
 * `lib/scheduling/adapters.ts`). Where the server is authoritative for a value
 * the client used to compute itself, that is called out on the field.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared unions                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type ShiftType = "morning" | "evening" | "night" | "split" | "custom";

/**
 * Whether a shift has reached Humanity yet.
 *
 * `pending` and `parked` shifts are REAL AND SAVED — never hide them or render
 * them as errors. They are simply not yet visible to staff in Humanity.
 * `parked` will not resolve on its own and needs a human.
 */
export type ShiftSyncStatus = "synced" | "pending" | "parked";

/**
 * Where a shift was last written. `humanity` / `reconciler` mean it was created
 * or changed in Humanity's own app rather than here — Humanity always wins.
 */
export type ShiftOrigin = "operations" | "humanity" | "reconciler";

export type ScheduleMode = "planned" | "actual" | "both";

/** Retained for the parked day/month views. The live UI only renders the week grid. */
export type ScheduleViewMode = "week" | "day" | "month";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store settings & departments                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StoreScheduleSettings {
  storeNumber: string;
  name: string;
  timezone: string;
  /** "HH:mm" */
  openTime: string;
  /** "HH:mm". Midnight means the END of the day, not a zero-length day. */
  closeTime: string;
  slotMinutes: number;
  overtimeThresholdHours: number;
  defaultLaborRate: number;
}

export interface ScheduleDepartment {
  id: string;
  name: string;
  humanityPositionId?: string | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employees                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type EmployeeStatus = "hired" | "rehired" | "resigned" | "terminated";

export interface ScheduleEmployee {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  department: string;
  /** Server-assigned initials. */
  avatar: string;
  /** Server-assigned and STABLE per employee — never re-derive this client-side. */
  color: string;
  isActive: boolean;
  status?: EmployeeStatus | null;
  humanityEmployeeId?: string | null;
  /** `false` means no Humanity counterpart yet, so the employee CANNOT be scheduled. */
  synced: boolean;
  /**
   * The employee's CURRENT rate, not the rate in force on the date being viewed.
   * `null` falls back to the store's default labor rate.
   */
  hourlyRate?: number | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shifts                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Shift {
  /** ASSIGNMENT id — the card's identity and its React key. */
  id: string;
  /**
   * SHIFT id — required for every update and delete. One Humanity shift can
   * hold several employees, so `id` (the assignment) is not addressable.
   */
  shiftId: string;
  employeeId: string;
  /** Column index within the store's business week. Computed SERVER-SIDE. */
  dayIndex: number;
  /** Local business date of the shift's START, "YYYY-MM-DD". */
  shiftDate: string;
  /** "HH:mm" 24h */
  startTime: string;
  /** "HH:mm" 24h. May be <= startTime — shifts legitimately cross midnight. */
  endTime: string;
  /**
   * Authoritative duration from the server. USE THIS FOR HOURS, always.
   * Wall-clock end-minus-start is wrong on the two DST changeover days.
   */
  durationMinutes: number;
  crossesMidnight?: boolean;
  label: string;
  type: ShiftType;
  note?: string;
  /** Returned and rendered on read, but series generation is not implemented server-side. */
  isRecurring?: boolean;
  recurringGroupId?: string;
  /** Deleting a published shift requires the confirm flag. */
  isPublished: boolean;
  syncStatus: ShiftSyncStatus;
  origin: ShiftOrigin;
  /**
   * Set only on a shift produced by `mergeActualShifts` from an OPEN actual —
   * somebody is still on the clock, so `endTime` there is a placeholder rather
   * than a recorded time. Never set on a planned shift.
   */
  isOpen?: boolean;
  department?: string | null;
  /** `null` while `syncStatus` is `pending` — an id only arrives once Humanity accepts. */
  humanityShiftId?: string | null;
  updatedAt?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Actual shifts (what really happened)                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * How the recorded times compare with the plan. DERIVED server-side on every
 * write and by the TCP sync — never sent by a client, and rejected if you do.
 *
 * Note the server compares LABEL as well as times, and applies no tolerance at
 * all: a two-minute punch reads `differs`. The grid deliberately does not, so
 * see `MATCH_TOLERANCE_MINUTES` before treating this as the display rule.
 */
export type ActualTimeVariance = "matches" | "differs" | "unplanned";

/**
 * The human verdict on a record. Only an explicit action sets it; no background
 * job touches it — which is what stops a sync turning a manager's recorded
 * no-show back into "worked as planned".
 *
 * This is the only half of the pair a client may write.
 */
export type ActualReviewState = "unreviewed" | "worked" | "absent";

export type ActualShiftSource = "manual" | "timeclock";

/** Where a punch was made. */
export type SegmentOrigin =
  /** Through our own clock-in / clock-out buttons. */
  | "punch"
  /** A manager hand-entered these hours. */
  | "manual"
  /** The sync found it already in TCP — a physical clock, or TCP's own web app. */
  | "discovered";

/**
 * One clock-in→clock-out pair inside an actual shift.
 *
 * A shift is a roll-up over these, because punching out and back in closes one
 * segment and opens another — so a single shift arrives as two or more rows
 * whenever somebody steps off the clock.
 *
 * NOT the same shape as the segment the clocking endpoints return; that one is
 * a live view carrying TCP's own ids and the pre-rounding punch times. The two
 * are deliberately separate types.
 */
export interface ActualShiftSegment {
  /** OUR row id. This is what `/split` takes. */
  id: string;
  /** TCP's own id. Useful in a support ticket; never key on it. */
  workSegmentId: string;
  /** `"YYYY-MM-DD HH:MM:SS"`, store-local wall clock, NO offset. Never `new Date()` it. */
  timeIn: string;
  /** Same format. `null` means on the clock right now. */
  timeOut: string | null;
  /** `null` while open. */
  durationMinutes: number | null;
  isOpen: boolean;
  /** TCP flagged this segment incomplete — the time is a system default, not a punch. */
  hasMissedPunch: boolean;
  origin: SegmentOrigin;
  /** TCP's note. The manager's note is `note` on the shift itself. */
  note?: string;
}

export interface ActualShift {
  id: string;
  employeeId: string;
  dayIndex: number;
  shiftDate: string;
  startTime: string;
  /**
   * "HH:mm" 24h, or `null` when `isOpen` — the person is still on the clock.
   *
   * Deliberately not filled in with "now": that would make a running shift look
   * finished with an end time that crept forward on every refresh.
   */
  endTime: string | null;
  /**
   * Authoritative duration from the server — see `Shift.durationMinutes`.
   *
   * The SUM OF THE SEGMENTS, not the span from first punch-in to last punch-out,
   * so time spent off the clock is not paid and not counted. On an open shift it
   * is the minutes worked so far.
   */
  durationMinutes: number;
  /** Somebody is on the clock; this shift has not finished. */
  isOpen: boolean;
  label: string;
  type: ShiftType;
  timeVariance: ActualTimeVariance;
  reviewState: ActualReviewState;
  /**
   * The server's own verdict on whether this warrants a manager's look: a missed
   * punch, a forgotten clock-out past the cap, a finished shift that does not
   * match the plan, or hours that changed after somebody signed them off.
   *
   * Drives the review filter, NOT the card's colour — the two disagree because
   * the server applies no tolerance. See `MATCH_TOLERANCE_MINUTES`.
   */
  needsAttention: boolean;
  /** A manager merged or split this by hand, so automatic grouping leaves it alone. */
  groupingPinned: boolean;
  /** Always present, usually length 1. */
  segments: ActualShiftSegment[];
  /** The originating ASSIGNMENT id. Absent for ad-hoc coverage. */
  plannedShiftId?: string;
  note?: string;
  source?: ActualShiftSource;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Clocking (TCP Manager+)                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A punch as the clocking endpoints report it.
 *
 * Not the same shape as `ActualShiftSegment`, and deliberately not shared with
 * it: that one is the stored row and carries our id, its duration and the
 * manager's note, while this is the live view and carries TCP's own ids and
 * the pre-rounding punch times instead. One interface covering both would be
 * mostly optional fields and would lose exactly the distinction that matters.
 */
export interface ClockSegment {
  /** TCP's id for the punch. There is no row id here — nothing to address. */
  workSegmentId: string;
  tcpEmployeeId: string;
  jobCodeId: string;
  /** `"YYYY-MM-DD HH:MM:SS"`, store-local wall clock, NO offset. */
  timeIn: string;
  timeOut: string | null;
  /**
   * What the employee PHYSICALLY punched, before TCP applied its rounding.
   *
   * For settling a dispute, not for the grid — showing it next to the recorded
   * time invites the question of which one is the real one, and the answer for
   * pay purposes is always the rounded one.
   */
  actualTimeIn: string | null;
  actualTimeOut: string | null;
  isOpen: boolean;
  hasMissedPunch: boolean;
  origin: SegmentOrigin;
}

/** One person currently on the clock. */
export interface OnTheClockEntry {
  employeeId: string;
  employeeName: string;
  /**
   * When they clocked in, as UTC with an offset.
   *
   * THE one UTC value in this API, sitting right next to `segment.timeIn`,
   * which is local wall clock with no offset. Same instant, two notations: use
   * this to compute elapsed time and `timeIn` to display it.
   */
  since: string;
  minutesSoFar: number;
  segment: ClockSegment | null;
}

export interface ClockStatus {
  employeeId: string;
  /**
   * Whether TCP knows this person at all.
   *
   * `false` is NOT "clocked out" — no hours can be attributed to them until
   * somebody links them, and punching would be refused. Say so plainly rather
   * than showing an inviting clock-in button.
   */
  linkedToTcp: boolean;
  clockedIn: boolean;
  segment: ClockSegment | null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Availability & time off                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** `employee_profile` rows are read-only here — they must be changed in HiringPizza. */
export type AvailabilitySource = "employee_profile" | "override";

/**
 * A BLOCKED window. HiringPizza stores the inverse (when someone IS available);
 * the backend inverts it against store hours and layers manager overrides on top.
 * An employee with no availability on file is fully available — render nothing.
 */
export interface AvailabilityRule {
  id: string;
  employeeId: string;
  dayIndex: number;
  date?: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
  source?: AvailabilitySource;
}

export type TimeOffType = "pto" | "vacation" | "sick" | "unpaid" | "other";

export type TimeOffStatus = "pending" | "approved" | "denied";

/** `humanity` rows cannot be deleted here — they would reappear on the next sync. */
export type TimeOffOrigin = "humanity" | "operations";

/** Already expanded to one entry per day: a 4-day leave is 4 rows sharing one `timeOffId`. */
export interface TimeOffEntry {
  /** Synthetic per-day id, `{timeOffId}-{dayIndex}`. */
  id: string;
  /** The underlying leave id — USE THIS TO DELETE, not `id`. */
  timeOffId: string;
  employeeId: string;
  dayIndex: number;
  date?: string;
  type: TimeOffType;
  label: string;
  status?: TimeOffStatus;
  origin?: TimeOffOrigin;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Conflicts                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Computed server-side on UTC instants, so it catches a 22:00-02:00 shift
 * colliding with the next morning's 01:00-09:00 one — the case a wall-clock
 * client check misses. Ids are ASSIGNMENT ids; resolve them against `shifts`.
 */
export interface ShiftConflict {
  employeeId: string;
  shiftAId: string;
  shiftBId: string;
  shiftDate: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Week                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface WeekInfo {
  /** True week start after the server snapped it, "YYYY-MM-DD". */
  start: string;
  /** "YYYY-MM-DD" */
  end: string;
  label: string;
  /** Day-of-month strings for the 7 columns, e.g. ["4","5"]. */
  dayDates: string[];
  /** The 7 column dates, "YYYY-MM-DD". Use these for absolute `shiftDate` values. */
  fullDates: string[];
  /** 0=Sun..6=Sat. Which weekday the store's business week starts on. PER-STORE. */
  weekStartDow: number;
  /** Long day names for the 7 columns, rotated to `weekStartDow`. */
  dayNames: string[];
  /** Short day names for the 7 columns, rotated to `weekStartDow`. */
  dayNamesShort: string[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stats                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ScheduleStats {
  totalHours: number;
  totalShifts: number;
  activeEmployees: number;
  laborCost: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Templates & publishing                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  /** Stored week-relative by `dayIndex`. Only present on the show endpoint. */
  shifts?: TemplateShift[];
  shiftCount: number;
  totalHours: number;
}

/** A template's shift is week-relative and carries no server-assigned identity. */
export interface TemplateShift {
  employeeId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  label: string;
  type: ShiftType;
  note?: string;
}

export interface PublishedSchedule {
  id: string;
  weekStartDate: string;
  weekLabel: string;
  publishedAt: string;
  unpublishedAt?: string | null;
  /** A URL to a stored file — NOT a base64 data URL. */
  screenshotUrl?: string | null;
  shiftCount: number;
  totalHours: number;
  /** Frozen snapshot. Only present on the show endpoint. */
  shifts?: Shift[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Bulk operations                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type BulkOperationType =
  | "bulk_create"
  | "copy_week"
  | "apply_template"
  | "clear_week"
  | "publish_week"
  | "unpublish_week"
  | "restore_published"
  | "recurring_expand"
  | "retry_failed";

export type BulkOperationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

/** Only ever populated with the FAILED items. A clean run returns an empty array. */
export interface BulkOperationItem {
  sequence: number;
  action: string;
  status: string;
  employeeId?: string;
  employeeName?: string;
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface BulkOperation {
  id: string;
  type: BulkOperationType;
  status: BulkOperationStatus;
  total: number;
  succeeded: number;
  failed: number;
  progressPercent: number;
  weekStartDate?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  items: BulkOperationItem[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee sync                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type EmployeeSyncRequestStatus =
  | "requested"
  | "fulfilled"
  | "failed"
  /** Already in TCP, waiting on TCP's own connector to publish into Humanity. */
  | "awaiting_tcp_connector";

export interface EmployeeSyncStatus {
  employeeId: string;
  employeeName: string;
  humanityEmployeeId?: string | null;
  /** Poll until true — this is what gates scheduling. */
  synced: boolean;
  tcpEmployeeId?: string | null;
  /** The earlier step: TCP linkage happens before Humanity. */
  syncedToTcp?: boolean;
  syncRequest?: {
    status: EmployeeSyncRequestStatus;
    requestedAt?: string | null;
    fulfilledAt?: string | null;
    attempts?: number;
    lastError?: string | null;
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Errors                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/** Branch on these codes, never on the message text. */
export type SchedulingErrorCode =
  | "EMPLOYEE_NOT_SYNCED"
  | "SHIFT_CONFLICT"
  | "EMPLOYEE_UNAVAILABLE"
  | "EMPLOYEE_ON_TIME_OFF"
  | "SHIFT_PUBLISHED"
  | "TIME_OFF_READ_ONLY"
  | "INVALID_LOCAL_TIME"
  | "STORE_NOT_MAPPED"
  | "POSITION_NOT_MAPPED"
  | "EMPLOYEE_NOT_IN_STORE"
  | "SHIFT_UNASSIGNED"
  | "HUMANITY_WRITE_FAILED"
  | "HUMANITY_RATE_LIMITED"
  /* Worked hours write through to TCP Manager+; these are its failure modes. */
  | "EMPLOYEE_NOT_IN_TCP"
  | "TCP_WRITE_FAILED"
  | "TCP_RATE_LIMITED"
  | "TCP_DAILY_QUOTA_EXHAUSTED"
  | "STORE_NOT_ALLOWLISTED"
  /* Punching in and out. Re-verified against TCP before being refused. */
  | "ALREADY_CLOCKED_IN"
  | "NOT_CLOCKED_IN"
  /* A split that would leave the shift it came from with no punches at all. */
  | "INVALID_SPLIT";

/** The three 409s a manager may override by resending the identical payload with `force`. */
export const FORCEABLE_ERROR_CODES: readonly SchedulingErrorCode[] = [
  "SHIFT_CONFLICT",
  "EMPLOYEE_UNAVAILABLE",
  "EMPLOYEE_ON_TIME_OFF",
];

/** Configuration problems a manager retrying will never fix. */
export const SETUP_ERROR_CODES: readonly SchedulingErrorCode[] = [
  "STORE_NOT_MAPPED",
  "POSITION_NOT_MAPPED",
  // Not switched on for external writes yet. Expected during the pilot, and
  // no amount of retrying by a manager will change it.
  "STORE_NOT_ALLOWLISTED",
];
