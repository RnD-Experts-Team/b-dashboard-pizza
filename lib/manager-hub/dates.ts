import { addDaysIso, todayIso } from "@/lib/dough-sauce/dates";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Manager Hub date window — calendar days only, as local "YYYY-MM-DD".     */
/*                                                                            */
/*  Everything here is string math on date-only values (via addDaysIso, a   */
/*  local-midnight constructor), never `new Date("YYYY-MM-DD")` — that parses */
/*  as UTC and lands on the previous day in every US store. Display goes      */
/*  through lib/utils/date-display.ts.                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/** How many days before the anchor count as "missed this week". */
export const BACKLOG_DAYS = 7;

/** Range choices for the Employee Debriefs tab (days, ending on the anchor). */
export const EMPLOYEE_DEBRIEF_RANGES = [7, 14, 30] as const;
export type EmployeeDebriefRange = (typeof EMPLOYEE_DEBRIEF_RANGES)[number];

export interface HubWindow {
  /** The day being tracked — today unless the manager picked another day. */
  anchor: string;
  /** First day of the backlog (anchor − BACKLOG_DAYS). */
  backlogFrom: string;
  /** Last day of the backlog (the day before the anchor). */
  backlogTo: string;
}

export { todayIso };

export function hubWindow(anchor: string, days: number = BACKLOG_DAYS): HubWindow {
  return {
    anchor,
    backlogFrom: addDaysIso(anchor, -days),
    backlogTo: addDaysIso(anchor, -1),
  };
}

/** First day of an N-day range that ends on (and includes) `anchor`. */
export function rangeStart(anchor: string, days: number): string {
  return addDaysIso(anchor, -(days - 1));
}

/** Inclusive string comparison — valid because the format is fixed-width. */
export function isoInRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

/** "YYYY-MM-DD" check, for values that come from the URL. */
export function isIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The calendar day of a timestamp, in the viewer's zone — used to bucket an
 * employee debrief that carries only `createdAt`. Date-only input passes through.
 */
export function localDayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(" ", "T") : value;
  const d = new Date(normalised);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10) || null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
