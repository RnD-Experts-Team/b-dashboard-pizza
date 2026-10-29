/**
 * Screen Project monitoring — what "fully connected" means. A store should
 * have its screens watched for its opening hours, read from the store's
 * pizzasys metadata (`open_utc` / `close_utc`, "HH:MM" in UTC, already on the
 * page from the auth calls); a manager's target is 8 hours a day.
 */

import { differenceInCalendarDays, format, parseISO } from "date-fns";

const SECOND_MS = 1000;
const HOUR_MIN = 60;
const MINUTE_MS = HOUR_MIN * SECOND_MS;
const DAY_HOURS = 24;
const DAY_MIN = DAY_HOURS * HOUR_MIN;
const DAY_MS = DAY_MIN * MINUTE_MS;
const MANAGER_DAILY_HOURS = 8;

export const MANAGER_DAILY_TARGET_S = MANAGER_DAILY_HOURS * HOUR_MIN * HOUR_MIN;

/** Minutes after 00:00 UTC. A close at or before the open is the next day. */
export interface OpenHours {
  open: number;
  close: number;
}

// "HH:MM" on a 24-hour clock: matches "13:00" and "4:05", rejects "1pm" and "13:5".
// https://regex101.com/?regex=%5E(%5Cd%7B1%2C2%7D)%3A(%5Cd%7B2%7D)%24&testString=13%3A00
const HH_MM = /^(\d{1,2}):(\d{2})$/;

function minutes(value: unknown): number | null {
  const m = typeof value === "string" ? HH_MM.exec(value.trim()) : null;
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < DAY_HOURS && min < HOUR_MIN ? h * HOUR_MIN + min : null;
}

export function storeOpenHours(metadata: Record<string, unknown> | undefined): OpenHours | null {
  const open = minutes(metadata?.open_utc);
  const close = minutes(metadata?.close_utc);
  return open === null || close === null ? null : { open, close };
}

/** Seconds the store is open within [fromMs, toMs). */
export function openSeconds(hours: OpenHours, fromMs: number, toMs: number): number {
  const length = (hours.close > hours.open ? hours.close - hours.open : hours.close + DAY_MIN - hours.open) * MINUTE_MS;
  // Start a day early: yesterday's opening may still run into the range.
  const firstDay = Math.floor(fromMs / DAY_MS) * DAY_MS - DAY_MS;
  const days = Math.max(0, Math.ceil((toMs - firstDay) / DAY_MS));
  const total = Array.from({ length: days }, (_, i) => firstDay + i * DAY_MS + hours.open * MINUTE_MS).reduce(
    (sum, start) => sum + Math.max(0, Math.min(start + length, toMs) - Math.max(start, fromMs)),
    0,
  );
  return total / SECOND_MS;
}

/** Days of the inclusive range that have started (today counts in full). */
export function startedDays(startDate: string, endDate: string, now: Date = new Date()): number {
  const today = format(now, "yyyy-MM-dd");
  const last = endDate < today ? endDate : today;
  return Math.max(0, differenceInCalendarDays(parseISO(last), parseISO(startDate)) + 1);
}
