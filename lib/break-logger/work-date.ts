/**
 * Work-date arithmetic for Breaks.
 *
 * A work day runs cutoff-to-cutoff in the API's own time zone (06:00 UTC by
 * default, but NEVER hardcoded — both come from `break-settings.work_day`),
 * and a break belongs to the day it STARTED in. Handing a local calendar date
 * to `?date=` / `?from=` / `?to=` is off by one for anyone breaking late at
 * night or early in the morning, so every date the UI sends goes through here.
 */

/** Days kept upstream before `breaks:prune` hard-deletes them. */
export const RETENTION_DAYS = 30;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Wall-clock parts of `instant` as seen in `timeZone`. */
function zonedParts(instant: Date, timeZone: string) {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    // Unknown zone string from the server — UTC is the documented default.
    return zonedParts(instant, "UTC");
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
  };
}

/** Add whole days to a `YYYY-MM-DD` string (calendar-safe, zone-free). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** The work date an instant belongs to. */
export function workDateOf(
  instant: Date,
  cutoffHour: number,
  timeZone: string
): string {
  const p = zonedParts(instant, timeZone);
  const calendar = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  return p.hour < cutoffHour ? shiftDate(calendar, -1) : calendar;
}

/** Oldest work date the server still holds (inclusive). */
export function retentionMinDate(today: string): string {
  return shiftDate(today, -(RETENTION_DAYS - 1));
}

export function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function isIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Seconds elapsed since an ISO timestamp, never negative. */
export function elapsedSeconds(startedAt: string, now: number): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** `m:ss`, or `h:mm:ss` past an hour — for a single ticking clock. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * `floor(seconds / 60)` — the API's own display rule. Use it for ONE entry's
 * live value only; never sum per-entry minutes (the floor of a sum is not the
 * sum of floors). Totals come from the server's `*_minutes` fields.
 */
export function floorMinutes(seconds: number): number {
  return Math.floor(Math.max(0, seconds) / 60);
}

/* ── datetime-local <-> ISO with offset ─────────────────────────────── */

/** ISO-8601 with the browser's explicit offset, e.g. `2026-09-15T14:02:00+03:00`. */
export function toIsoWithOffset(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** `YYYY-MM-DDTHH:mm` (the value of <input type="datetime-local">) from an ISO string. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value (local wall time) into ISO with offset. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return toIsoWithOffset(d);
}

/** Same instant? Compares at minute precision, like the inputs do. */
export function sameMinute(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return a === b;
  return Math.floor(new Date(a).getTime() / 60000) === Math.floor(new Date(b).getTime() / 60000);
}
