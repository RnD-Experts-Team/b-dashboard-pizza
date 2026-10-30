/**
 * Date and number display for the ticket page. Calendar days (`YYYY-MM-DD`)
 * are read as local days, never as UTC midnights; instants go through the
 * viewer's clock (LocalTimestamp does the labelled version).
 */

import { format } from "date-fns";
import { parseDecimal, toMoneyString } from "@/lib/maintenance/money";

const DAY_PATTERN = "EEE, MMM d, yyyy";
const LOCAL_INPUT_PATTERN = "yyyy-MM-dd'T'HH:mm";
const DAY_LENGTH = 10;

/** "Tue, Apr 22, 2026" for a calendar day; "—" for nothing. */
export function formatDay(day: string | null | undefined, empty = "—"): string {
  if (!day) return empty;
  const d = new Date(`${day.slice(0, DAY_LENGTH)}T00:00`);
  return Number.isFinite(d.getTime()) ? format(d, DAY_PATTERN) : day;
}

/** "Tue, Apr 22, 2026 · 9:15" when a time is known. */
export function formatDayTime(day: string | null | undefined, time: string | null | undefined): string {
  const base = formatDay(day);
  return time ? `${base} · ${time}` : base;
}

/** Now, as the DateTimePicker's local `YYYY-MM-DDTHH:mm`. */
export function localNow(): string {
  return format(new Date(), LOCAL_INPUT_PATTERN);
}

/** Today as `YYYY-MM-DD`. */
export function todayDay(): string {
  return localNow().slice(0, DAY_LENGTH);
}

/** An instant → the picker's local `YYYY-MM-DDTHH:mm`. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? format(d, LOCAL_INPUT_PATTERN) : "";
}

/** The picker's local value → an ISO instant for the API; null for empty. */
export function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** A typed amount the API will take ("12.5" → "12.50"); null when empty or invalid. */
export function amountOrNull(raw: string): string | null {
  const n = parseDecimal(raw);
  return n == null || n < 0 ? null : toMoneyString(n);
}
