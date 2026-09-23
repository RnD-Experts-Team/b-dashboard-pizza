import { format, parseISO } from "date-fns";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Display formatting — NEVER use `new Date(dateOnlyString)`                 */
/*                                                                           */
/*  `new Date("2026-08-04")` parses a date-only string as UTC MIDNIGHT, then  */
/*  renders it in the viewer's timezone. In every negative-offset zone — i.e. */
/*  every US store — that shows THE PREVIOUS DAY:                             */
/*                                                                           */
/*    new Date("2026-08-04").toLocaleDateString()  -> 8/3/2026   WRONG        */
/*    formatDateOnly("2026-08-04", "MMM d")        -> Aug 4      correct      */
/*                                                                           */
/*  date-fns `parseISO` treats a date-only string as LOCAL midnight, so the   */
/*  round trip is lossless. Every helper below goes through it. A date the    */
/*  API sent as "2026-08-04" must always render as August 4th.                */
/*                                                                           */
/*  ── Four invariants every function here holds ───────────────────────────  */
/*   1. Empty input returns "" — never the string "undefined".               */
/*   2. Parse with the shape-correct parser.                                 */
/*   3. NaN-GUARD BEFORE `format`. date-fns `format` THROWS RangeError on an  */
/*      Invalid Date; guarding first is what makes these never throw. That    */
/*      matters — an unguarded formatter inside a table row takes the whole   */
/*      page down through the error boundary, not one cell.                   */
/*   4. On failure return the RAW INPUT — never the literal "Invalid Date",   */
/*      never "". A visible bad value is debuggable; a blank cell is not.     */
/*                                                                           */
/*  Ported from lib/scheduling/week.ts:135-210, which keeps its own copy for  */
/*  now. Renamed on the way in: lib/utils/date-range.ts already exports a     */
/*  `formatIsoDate`, and that one goes the OTHER way (Date -> "YYYY-MM-DD").  */
/*  Two identically-named opposite-direction helpers one file apart is how    */
/*  this repo ended up with thirteen copies of "format a date" to begin with. */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Format an API date-only string ("YYYY-MM-DD") for display.
 *
 * Use for every field whose contract is a calendar date with no time:
 * `entry.date`, `assignedDate`, `newDate`, `expiryDate`, `claim.date`.
 */
export function formatDateOnly(iso: string, pattern = "MMM d, yyyy"): string {
  if (!iso) return "";
  try {
    const parsed = parseISO(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return format(parsed, pattern);
  } catch {
    // Also covers an invalid format token, since `pattern` is caller-supplied.
    return iso;
  }
}

/** "Tuesday, Aug 4" — for dialog headers and day labels. */
export function formatDateOnlyWithWeekday(iso: string): string {
  return formatDateOnly(iso, "EEEE, MMM d");
}

/**
 * Format a full ISO TIMESTAMP (one carrying a time, and usually an offset).
 *
 * Timestamps are unambiguous, so `new Date()` is safe for them — unlike
 * date-only strings. Kept as a separate named function so the choice stays
 * visible at every call site rather than being a detail of one helper.
 */
export function formatTimestamp(iso: string, pattern = "MMM d, yyyy h:mm a"): string {
  if (!iso) return "";
  try {
    const parsed = parseISO(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return format(parsed, pattern);
  } catch {
    return iso;
  }
}

/**
 * Parse to a Date, or null when the input is empty or unparseable.
 *
 * For the cases the formatters above cannot serve: when a call site must do
 * DATE ARITHMETIC before formatting (`addDays(parseISO(weekStart), 6)`).
 * Bare `parseISO` hands back an Invalid Date that survives the arithmetic and
 * only blows up inside `format()`, which THROWS — so the crash surfaces far
 * from the bad input. This makes the failure a null the caller must handle.
 *
 * Same parser as the formatters, so a date-only string still lands on LOCAL
 * midnight and cannot shift a day.
 */
export function parseDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  try {
    const parsed = parseISO(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * True when the string is a bare "YYYY-MM-DD" with no time component.
 *
 * DELIBERATELY STRICT (anchored at both ends). A loose prefix test would also
 * match a full timestamp and quietly strip its time — which is exactly the
 * ambiguity these named functions exist to remove. Do not relax it; if a call
 * site turns out to receive both shapes, move that call site to
 * `formatDateOrTimestamp` instead.
 */
export function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Format either shape correctly, picking the safe parser for each.
 *
 * For a field genuinely known to carry both — e.g. one helper rendering an
 * audit trail of `assignedDate` (date-only) alongside `createdAt` (timestamp).
 * Prefer the explicit functions wherever the shape IS known.
 */
export function formatDateOrTimestamp(iso: string, pattern?: string): string {
  if (!iso) return "";
  return isDateOnly(iso)
    ? formatDateOnly(iso, pattern)
    : formatTimestamp(iso, pattern);
}

/**
 * Format a datetime whose WIRE SHAPE IS NOT GUARANTEED.
 *
 * Three shapes can arrive on one such field and all three must render:
 *
 *   "2026-09-14"                     date-only  -> no time is invented
 *   "2026-09-14T10:30:00(Z|±hh:mm)"  RFC3339
 *   "2026-09-14 10:30:00"            MySQL / Laravel `Y-m-d H:i:s`
 *
 * The third is why this exists. `new Date("2026-09-14 10:30:00")` is
 * IMPLEMENTATION-DEFINED: V8 accepts it, JavaScriptCore returns Invalid Date —
 * so the same row renders fine in Chrome and blank in Safari. Swapping the
 * separator for a "T" puts every engine on the standard ISO path.
 *
 * The date-only branch renders NO TIME. Falling through to a datetime pattern
 * would print "Sep 14, 2026 00:00" — an invented fact, which on a stock ledger
 * is worse than a missing one.
 *
 * Prefer `formatDateOnly` / `formatTimestamp` wherever the shape IS known;
 * reach for this only while a contract is genuinely unconfirmed.
 */
export function formatWireDateTime(
  iso: string,
  opts?: { datePattern?: string; dateTimePattern?: string }
): string {
  if (!iso) return "";
  if (isDateOnly(iso)) return formatDateOnly(iso, opts?.datePattern ?? "MMM d, yyyy");

  const normalised = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso)
    ? iso.replace(" ", "T")
    : iso;

  try {
    const parsed = parseISO(normalised);
    if (Number.isNaN(parsed.getTime())) return iso;
    return format(parsed, opts?.dateTimePattern ?? "MMM d, yyyy HH:mm");
  } catch {
    return iso;
  }
}
