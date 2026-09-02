import type { ScheduleWeekData } from "@/lib/scheduling/adapters";

/**
 * Short-lived in-memory cache for `GET /schedule/week`.
 *
 * The scheduling grid used to refetch every time the user switched between
 * Planned, Actual and Compare. It no longer does: the hook always asks for
 * `mode=both` and the three views are derived from that one response, so this
 * cache exists for the remaining case — navigating away from a week and coming
 * back to it.
 *
 * Deliberately NOT a Zustand store and NOT persisted:
 *
 *   Nothing renders from here — `useScheduleWeek` copies a hit into its own
 *   state — so a store would add subscription machinery for no subscriber.
 *
 *   Entries die with the tab. A page reload is the one gesture every user
 *   already knows for "give me fresh data", and persisting server data would
 *   take that away while leaving employee schedules sitting in localStorage.
 *
 * The TTL idiom matches the `STALE_AFTER_MS` + `Date.now()` shape used by
 * `lib/store/dspr.store.ts` and its siblings; the keyed-entry + prune shape
 * matches `lib/scheduling/draft.store.ts`. What is new here is the read-through
 * gate: those stores consult staleness only from auto-refresh timers and never
 * actually skip a fetch.
 */

const TTL_MS = 5 * 60_000;

/**
 * `search` and `department` are part of the key, so an unbounded map would grow
 * with every filter combination a user tries. 24 is far more than one session
 * revisits and still trivially small.
 */
const MAX_ENTRIES = 24;

interface Entry {
  data: ScheduleWeekData;
  fetchedAt: number;
}

const entries = new Map<string, Entry>();

/**
 * `mode` is absent on purpose — every request now asks for `both`, so it is
 * constant and would only pad the key.
 */
export function keyFor(
  storeId: string,
  weekStart: string,
  department?: string,
  search?: string,
): string {
  return [storeId, weekStart, department || "All", search || ""].join("|");
}

/** The entry for `key` if it exists and is still inside the TTL. */
export function readFresh(key: string): ScheduleWeekData | undefined {
  const hit = entries.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.fetchedAt >= TTL_MS) {
    entries.delete(key);
    return undefined;
  }
  return hit.data;
}

/** True when `key` has no entry, or one that has aged out. */
export function isStale(key: string): boolean {
  return readFresh(key) === undefined;
}

/** How long ago `key` was fetched, in ms, or null when it is not cached. */
export function ageOf(key: string): number | null {
  const hit = entries.get(key);
  return hit ? Date.now() - hit.fetchedAt : null;
}

/**
 * When `key` was fetched, as an epoch timestamp, or null when it is not cached.
 *
 * Preferred over `ageOf` for anything rendered: a timestamp is stable across
 * renders, so a component can tick its own "N minutes ago" label without the
 * parent re-rendering the whole grid to recompute an age.
 */
export function fetchedAtOf(key: string): number | null {
  return entries.get(key)?.fetchedAt ?? null;
}

export function write(key: string, data: ScheduleWeekData): void {
  const now = Date.now();
  for (const [k, v] of entries) {
    if (now - v.fetchedAt >= TTL_MS) entries.delete(k);
  }
  // Map preserves insertion order, so the first key is the oldest write.
  while (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
  entries.set(key, { data, fetchedAt: now });
}

/**
 * Drop every cached week for one store.
 *
 * Store-wide rather than week-scoped because writes are not confined to the
 * week on screen: a recurring shift and an applied template both create shifts
 * in later weeks, which a week-scoped invalidation would leave cached and
 * wrong. Mutations are far rarer than toggles, and any other week would have
 * cost a request on first visit anyway.
 */
export function invalidateStore(storeId: string): void {
  const prefix = `${storeId}|`;
  for (const k of [...entries.keys()]) {
    if (k.startsWith(prefix)) entries.delete(k);
  }
}

/** Test/debug helper. */
export function clearAll(): void {
  entries.clear();
}

/*
 * NOTE — no request de-duplication here, deliberately.
 *
 * An earlier version shared one in-flight promise per key. That is unsafe with
 * the caller-owned AbortController this hook uses: the shared request carries
 * the FIRST caller's signal, so when that caller aborts (React StrictMode's
 * cleanup, or a fast week change) the request dies for every joiner, and they
 * swallow the cancellation as a normal abort — leaving an empty grid and no
 * error. The repo's established abort-previous pattern already keeps only the
 * latest request's result, which is what actually matters.
 */

/** Exported for tests and for the "updated N ago" copy. */
export const WEEK_CACHE_TTL_MS = TTL_MS;
