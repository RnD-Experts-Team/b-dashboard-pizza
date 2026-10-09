/**
 * People on the PLAN, hour by hour, for the week on screen.
 *
 * The staffing guide sets this beside what past weeks actually looked like, so
 * a manager sees a gap while still building the schedule. It counts saved
 * shifts and unsaved drafts alike, because drafts are exactly what is being
 * decided.
 *
 * Same basis as the history feeds: store-local hour of the business day, and the
 * small hours after midnight belong to the PREVIOUS date (`cutoff` is the first
 * hour of a new business day). Fractional, so a half-hour shift counts half.
 *
 * Works on wall-clock minutes and the server's `durationMinutes`, so a shift
 * that spans a clock change is off by an hour on those two days a year at most,
 * which is well inside what a planning chart needs.
 *
 * Pure and dependency-free.
 */

export interface CoverageShift {
  /** Local business date the shift starts on, "YYYY-MM-DD". */
  shiftDate: string;
  /** "HH:mm" */
  startTime: string;
  durationMinutes: number;
}

/** date -> 24 slots of people-hours, indexed by clock hour (0-23). */
export type HourlyCoverage = Record<string, number[]>;

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "HH:mm" to minutes after midnight. Returns NaN for anything unreadable. */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes between two "HH:mm" times, rolling over midnight. An equal pair is a full day. */
export function minutesBetween(start: string, end: string): number {
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? diff : diff + 1440;
}

export function plannedCoverage(shifts: CoverageShift[], cutoffHour = 5): HourlyCoverage {
  const out: HourlyCoverage = {};

  for (const shift of shifts) {
    const start = toMinutes(shift.startTime);
    if (!Number.isFinite(start) || shift.durationMinutes <= 0) continue;

    // Walk the shift a clock hour at a time.
    let cursor = start;
    const end = start + shift.durationMinutes;

    while (cursor < end) {
      const hourEnd = (Math.floor(cursor / 60) + 1) * 60;
      const slice = Math.min(hourEnd, end) - cursor;

      const hour = Math.floor((cursor % 1440) / 60);
      const dayOffset = Math.floor((cursor - cutoffHour * 60) / 1440);
      const date = addDays(shift.shiftDate, dayOffset);

      const slots = (out[date] ??= new Array<number>(24).fill(0));
      slots[hour] += slice / 60;

      cursor += slice;
    }
  }

  return out;
}
