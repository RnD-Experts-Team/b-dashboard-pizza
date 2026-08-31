/**
 * The API-to-UI boundary for scheduling.
 *
 * OperationsPizza speaks snake_case; the components speak camelCase. Everything
 * crosses here so no component ever has to know about `duration_minutes` or
 * decide what to do when a nullable field is missing.
 *
 * Two conventions this file enforces:
 *
 *   Ids are coerced to STRINGS. The API mixes them — `id` arrives as "42" but
 *   `shift_id` as the number 17 — and React keys and Map lookups must not
 *   depend on which. `String()` everywhere makes comparisons safe.
 *
 *   Dates stay as the API's own "YYYY-MM-DD" strings and are NEVER passed
 *   through `new Date()`. See the rules at the bottom of `week.ts`: doing so
 *   parses them as UTC midnight and renders the previous day in every
 *   negative-offset timezone.
 */

import type {
  ActualShift,
  ActualShiftSource,
  ActualShiftStatus,
  AvailabilityRule,
  AvailabilitySource,
  BulkOperation,
  BulkOperationItem,
  BulkOperationStatus,
  BulkOperationType,
  EmployeeStatus,
  EmployeeSyncRequestStatus,
  EmployeeSyncStatus,
  PublishedSchedule,
  ScheduleDepartment,
  ScheduleEmployee,
  ScheduleStats,
  ScheduleTemplate,
  Shift,
  ShiftConflict,
  ShiftOrigin,
  ShiftSyncStatus,
  ShiftType,
  StoreScheduleSettings,
  TemplateShift,
  TimeOffEntry,
  TimeOffOrigin,
  TimeOffStatus,
  TimeOffType,
  WeekInfo,
} from "@/types/scheduling.types";
import { DEFAULT_WEEK_START_DOW, dayLabelsFor } from "./week";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Primitive coercion                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

type Raw = Record<string, unknown>;

function rec(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function arr(value: unknown): Raw[] {
  return Array.isArray(value) ? value.map(rec) : [];
}

/** Ids arrive as strings or numbers depending on the field. Normalise to string. */
function id(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Keep an unrecognised union value out of the type system by falling back. */
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const SHIFT_TYPES: readonly ShiftType[] = [
  "morning",
  "evening",
  "night",
  "split",
  "custom",
];
const SYNC_STATUSES: readonly ShiftSyncStatus[] = ["synced", "pending", "parked"];
const ORIGINS: readonly ShiftOrigin[] = ["operations", "humanity", "reconciler"];
const ACTUAL_STATUSES: readonly ActualShiftStatus[] = [
  "confirmed",
  "modified",
  "absent",
  "added",
];
const ACTUAL_SOURCES: readonly ActualShiftSource[] = ["manual", "timeclock"];
const AVAILABILITY_SOURCES: readonly AvailabilitySource[] = [
  "employee_profile",
  "override",
];
const TIME_OFF_TYPES: readonly TimeOffType[] = [
  "pto",
  "vacation",
  "sick",
  "unpaid",
  "other",
];
const TIME_OFF_STATUSES: readonly TimeOffStatus[] = [
  "pending",
  "approved",
  "denied",
];
const TIME_OFF_ORIGINS: readonly TimeOffOrigin[] = ["humanity", "operations"];
const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
  "hired",
  "rehired",
  "resigned",
  "terminated",
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Week & store                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Build `WeekInfo` from the payload's own `week` object.
 *
 * The server has already snapped whatever date we sent to the store's true week
 * start, so these values are authoritative — the client must not recompute
 * them. Day names are derived from `week_start_dow` so a store whose week starts
 * Sunday is labelled correctly rather than Tuesday-first.
 */
export function adaptWeek(raw: unknown): WeekInfo {
  const w = rec(raw);
  const weekStartDow = num(w.week_start_dow, DEFAULT_WEEK_START_DOW);
  const labels = dayLabelsFor(weekStartDow);
  const fullDates = Array.isArray(w.full_dates)
    ? w.full_dates.map((d) => str(d))
    : [];
  const dayDates = Array.isArray(w.day_dates)
    ? w.day_dates.map((d) => id(d))
    : fullDates.map((d) => d.slice(8).replace(/^0/, ""));

  return {
    start: str(w.start),
    end: str(w.end),
    label: str(w.label),
    dayDates,
    fullDates,
    weekStartDow,
    dayNames: labels.long,
    dayNamesShort: labels.short,
  };
}

export function adaptStore(raw: unknown): StoreScheduleSettings {
  const s = rec(raw);
  return {
    storeNumber: id(s.store_number),
    name: str(s.name),
    timezone: str(s.timezone),
    openTime: str(s.open_time, "09:00"),
    closeTime: str(s.close_time, "00:00"),
    slotMinutes: num(s.slot_minutes, 30),
    overtimeThresholdHours: num(s.overtime_threshold_hours, 40),
    defaultLaborRate: num(s.default_labor_rate, 15),
  };
}

export function adaptDepartment(raw: unknown): ScheduleDepartment {
  const d = rec(raw);
  return {
    id: id(d.id),
    name: str(d.name),
    humanityPositionId: strOrNull(d.humanity_position_id),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employees                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function adaptEmployee(raw: unknown): ScheduleEmployee {
  const e = rec(raw);
  return {
    id: id(e.id),
    name: str(e.name),
    firstName: strOrNull(e.first_name) ?? undefined,
    lastName: strOrNull(e.last_name) ?? undefined,
    // `role` and `department` are both nullable upstream, but the grid renders
    // them as plain text, so an empty string is friendlier than "null".
    role: str(e.role),
    department: str(e.department),
    avatar: str(e.avatar),
    // Server-assigned and stable per employee — never re-derived here.
    color: str(e.color, "blue"),
    isActive: bool(e.is_active, true),
    status:
      typeof e.status === "string"
        ? oneOf(e.status, EMPLOYEE_STATUSES, "hired")
        : null,
    humanityEmployeeId: strOrNull(e.humanity_employee_id),
    // Defaulting to false would make everyone unschedulable if the field were
    // ever missing; defaulting to true matches "no reason to block".
    synced: bool(e.synced, true),
    hourlyRate: numOrNull(e.hourly_rate),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shifts                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export function adaptShift(raw: unknown): Shift {
  const s = rec(raw);
  const assignmentId = id(s.id);
  return {
    id: assignmentId,
    // The addressable shift id, distinct from the assignment id above. Falls
    // back to the assignment id so a malformed row still has a usable key,
    // though an update against it would fail loudly rather than silently.
    shiftId: id(s.shift_id, assignmentId),
    employeeId: id(s.employee_id),
    dayIndex: num(s.day_index),
    shiftDate: str(s.shift_date),
    startTime: str(s.start_time),
    endTime: str(s.end_time),
    durationMinutes: num(s.duration_minutes),
    crossesMidnight: bool(s.crosses_midnight),
    label: str(s.label),
    type: oneOf(s.type, SHIFT_TYPES, "custom"),
    note: strOrNull(s.note) ?? undefined,
    isRecurring: bool(s.is_recurring),
    recurringGroupId: strOrNull(s.recurring_group_id) ?? undefined,
    isPublished: bool(s.is_published),
    syncStatus: oneOf(s.sync_status, SYNC_STATUSES, "synced"),
    origin: oneOf(s.origin, ORIGINS, "operations"),
    department: strOrNull(s.department),
    // null while a shift is pending — it only gets an id once Humanity accepts.
    humanityShiftId: strOrNull(s.humanity_shift_id),
    updatedAt: strOrNull(s.updated_at) ?? undefined,
  };
}

export function adaptActualShift(raw: unknown): ActualShift {
  const a = rec(raw);
  return {
    id: id(a.id),
    employeeId: id(a.employee_id),
    dayIndex: num(a.day_index),
    shiftDate: str(a.shift_date),
    startTime: str(a.start_time),
    endTime: str(a.end_time),
    durationMinutes: num(a.duration_minutes),
    label: str(a.label),
    type: oneOf(a.type, SHIFT_TYPES, "custom"),
    // Derived server-side; read it, never assert it.
    status: oneOf(a.status, ACTUAL_STATUSES, "modified"),
    plannedShiftId: strOrNull(a.planned_shift_id) ?? undefined,
    note: strOrNull(a.note) ?? undefined,
    source: oneOf(a.source, ACTUAL_SOURCES, "manual"),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Availability & time off                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export function adaptAvailability(raw: unknown): AvailabilityRule {
  const r = rec(raw);
  return {
    id: id(r.id),
    employeeId: id(r.employee_id),
    dayIndex: num(r.day_index),
    date: strOrNull(r.date) ?? undefined,
    allDay: bool(r.all_day, true),
    startTime: strOrNull(r.start_time) ?? undefined,
    endTime: strOrNull(r.end_time) ?? undefined,
    reason: str(r.reason),
    source: oneOf(r.source, AVAILABILITY_SOURCES, "override"),
  };
}

export function adaptTimeOff(raw: unknown): TimeOffEntry {
  const t = rec(raw);
  const timeOffId = id(t.time_off_id);
  const dayIndex = num(t.day_index);
  return {
    // Synthetic per-day id. Rebuilt when absent so React keys stay unique.
    id: id(t.id, `${timeOffId}-${dayIndex}`),
    timeOffId,
    employeeId: id(t.employee_id),
    dayIndex,
    date: strOrNull(t.date) ?? undefined,
    type: oneOf(t.type, TIME_OFF_TYPES, "other"),
    label: str(t.label),
    status: oneOf(t.status, TIME_OFF_STATUSES, "approved"),
    origin: oneOf(t.origin, TIME_OFF_ORIGINS, "operations"),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Conflicts & stats                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export function adaptConflict(raw: unknown): ShiftConflict {
  const c = rec(raw);
  return {
    employeeId: id(c.employee_id),
    shiftAId: id(c.shift_a_id),
    shiftBId: id(c.shift_b_id),
    shiftDate: str(c.shift_date),
  };
}

export function adaptStats(raw: unknown): ScheduleStats {
  const s = rec(raw);
  return {
    totalHours: num(s.total_hours),
    totalShifts: num(s.total_shifts),
    activeEmployees: num(s.active_employees),
    laborCost: num(s.labor_cost),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Templates & publishing                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function adaptTemplateShift(raw: unknown): TemplateShift {
  const s = rec(raw);
  return {
    employeeId: id(s.employee_id),
    dayIndex: num(s.day_index),
    startTime: str(s.start_time),
    endTime: str(s.end_time),
    label: str(s.label),
    type: oneOf(s.type, SHIFT_TYPES, "custom"),
    note: strOrNull(s.note) ?? undefined,
  };
}

export function adaptTemplate(raw: unknown): ScheduleTemplate {
  const t = rec(raw);
  return {
    id: id(t.id),
    name: str(t.name),
    description: str(t.description),
    createdAt: str(t.created_at),
    // Only the show endpoint includes shifts; the list endpoint omits them.
    shifts: Array.isArray(t.shifts) ? arr(t.shifts).map(adaptTemplateShift) : undefined,
    shiftCount: num(t.shift_count),
    totalHours: num(t.total_hours),
  };
}

/**
 * Route a published screenshot through the same-origin rewrite.
 *
 * The API returns an absolute URL on the scheduling host. Pointing `next/image`
 * at it would need both a CSP allowance and a `remotePatterns` entry; sending it
 * through `/operations-storage/...` (see next.config.ts) keeps it same-origin,
 * which the existing `img-src 'self'` already covers. Same approach the
 * inventory and cleaning features use for their own storage images.
 */
export function resolveScreenshotUrl(url: string | null): string | null {
  if (!url) return url;
  const marker = "/storage/";
  const idx = url.indexOf(marker);
  // Not a storage path (e.g. an already-proxied or signed URL) — leave it alone.
  if (idx === -1) return url;
  return "/operations-storage/" + url.slice(idx + marker.length);
}

export function adaptPublished(raw: unknown): PublishedSchedule {
  const p = rec(raw);
  return {
    id: id(p.id),
    weekStartDate: str(p.week_start_date),
    weekLabel: str(p.week_label),
    publishedAt: str(p.published_at),
    unpublishedAt: strOrNull(p.unpublished_at),
    // A URL to a stored file, not a data URL, and optional. Rewritten to a
    // same-origin path so <Image> loads it without CSP or remotePatterns work.
    screenshotUrl: resolveScreenshotUrl(strOrNull(p.screenshot_url)),
    shiftCount: num(p.shift_count),
    totalHours: num(p.total_hours),
    shifts: Array.isArray(p.shifts) ? arr(p.shifts).map(adaptShift) : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Bulk operations                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const BULK_TYPES: readonly BulkOperationType[] = [
  "bulk_create",
  "copy_week",
  "apply_template",
  "clear_week",
  "publish_week",
  "unpublish_week",
  "restore_published",
  "recurring_expand",
  "retry_failed",
];
const BULK_STATUSES: readonly BulkOperationStatus[] = [
  "queued",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
];

function adaptBulkItem(raw: unknown): BulkOperationItem {
  const i = rec(raw);
  return {
    sequence: num(i.sequence),
    action: str(i.action),
    status: str(i.status),
    employeeId: strOrNull(i.employee_id) ?? undefined,
    employeeName: strOrNull(i.employee_name) ?? undefined,
    shiftDate: strOrNull(i.shift_date) ?? undefined,
    startTime: strOrNull(i.start_time) ?? undefined,
    endTime: strOrNull(i.end_time) ?? undefined,
    errorCode: strOrNull(i.error_code) ?? undefined,
    errorMessage: strOrNull(i.error_message) ?? undefined,
  };
}

export function adaptBulkOperation(raw: unknown): BulkOperation {
  const b = rec(raw);
  return {
    id: id(b.id),
    type: oneOf(b.type, BULK_TYPES, "bulk_create"),
    status: oneOf(b.status, BULK_STATUSES, "queued"),
    total: num(b.total),
    succeeded: num(b.succeeded),
    failed: num(b.failed),
    progressPercent: num(b.progress_percent),
    weekStartDate: strOrNull(b.week_start_date) ?? undefined,
    startedAt: strOrNull(b.started_at),
    finishedAt: strOrNull(b.finished_at),
    error: strOrNull(b.error),
    // Only failures are ever returned here.
    items: arr(b.items).map(adaptBulkItem),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee sync                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const SYNC_REQUEST_STATUSES: readonly EmployeeSyncRequestStatus[] = [
  "requested",
  "fulfilled",
  "failed",
  "awaiting_tcp_connector",
];

export function adaptEmployeeSyncStatus(raw: unknown): EmployeeSyncStatus {
  const s = rec(raw);
  const request = rec(s.sync_request);
  return {
    employeeId: id(s.employee_id),
    employeeName: str(s.employee_name),
    humanityEmployeeId: strOrNull(s.humanity_employee_id),
    synced: bool(s.synced),
    tcpEmployeeId: strOrNull(s.tcp_employee_id),
    syncedToTcp: bool(s.synced_to_tcp),
    syncRequest: s.sync_request
      ? {
          status: oneOf(request.status, SYNC_REQUEST_STATUSES, "requested"),
          requestedAt: strOrNull(request.requested_at),
          fulfilledAt: strOrNull(request.fulfilled_at),
          attempts: num(request.attempts),
          lastError: strOrNull(request.last_error),
        }
      : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The week payload                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ScheduleWeekData {
  week: WeekInfo;
  store: StoreScheduleSettings;
  employees: ScheduleEmployee[];
  departments: ScheduleDepartment[];
  shifts: Shift[];
  actualShifts: ActualShift[];
  availability: AvailabilityRule[];
  timeOff: TimeOffEntry[];
  published: PublishedSchedule | null;
  stats: ScheduleStats;
  overtimeEmployeeIds: Set<string>;
  conflicts: ShiftConflict[];
}

/**
 * Adapt the whole `GET /schedule/week` payload.
 *
 * One call returns everything the grid needs, which is why the week is refetched
 * after any successful write: `conflicts`, `stats`, `overtime_employee_ids` and
 * `sync_status` are all derived server-side and only stay truthful together.
 */
export function adaptScheduleWeek(raw: unknown): ScheduleWeekData {
  const d = rec(raw);
  return {
    week: adaptWeek(d.week),
    store: adaptStore(d.store),
    employees: arr(d.employees).map(adaptEmployee),
    departments: arr(d.departments).map(adaptDepartment),
    shifts: arr(d.shifts).map(adaptShift),
    // Absent entirely when mode=planned.
    actualShifts: arr(d.actual_shifts).map(adaptActualShift),
    availability: arr(d.availability).map(adaptAvailability),
    timeOff: arr(d.time_off).map(adaptTimeOff),
    published: d.published ? adaptPublished(d.published) : null,
    stats: adaptStats(d.stats),
    overtimeEmployeeIds: new Set(
      Array.isArray(d.overtime_employee_ids)
        ? d.overtime_employee_ids.map((v) => id(v))
        : []
    ),
    conflicts: arr(d.conflicts).map(adaptConflict),
  };
}
