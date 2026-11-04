import { FEED_MAX_STORES } from "./feed-types";
import type { CalendarView } from "./types";

/**
 * How a view asks the feeds for its data (FRONTEND_CALENDAR_REQUESTS.md, which
 * replaces §4 of the guide).
 *
 * ONE request per service for the whole visible range, whatever the number of
 * stores: 8 requests for a day, a week or a month. The server takes up to 62
 * days and 50 stores in one request, so a view is never split by weeks. The only
 * two reasons to send more are more than 50 stores (`chunkStores`) and more than
 * 62 days (the year view: unsupported until the backend ships `group=day`).
 *
 * Splitting a heavy request does not make it lighter, it sends the same payload
 * in more requests. The answer to a heavy month is `HEAVY_MONTH_STORES`: suggest
 * the Week view.
 * Pure: no React, no network.
 */

/**
 * Past this many stores a month is heavy: every request returns full events, so
 * 44 stores for a month is ~4-9 MB (guide §5). The page suggests Week instead.
 */
export const HEAVY_MONTH_STORES = 10;

export function isHeavyMonth(view: CalendarView, storeCount: number): boolean {
  return view === "month" && storeCount > HEAVY_MONTH_STORES;
}

/** Stores in groups of at most 50 (the contract's cap), one request each. Normally a single group. */
export function chunkStores<T>(stores: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < stores.length; i += FEED_MAX_STORES) chunks.push(stores.slice(i, i + FEED_MAX_STORES));
  return chunks;
}
