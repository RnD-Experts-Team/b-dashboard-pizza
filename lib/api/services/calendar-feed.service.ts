import axios, { isAxiosError } from "axios";
import { chunkStores } from "@/lib/calendar/feed-plan";
import {
  FEED_SOURCES,
  YEAR_SOURCES,
  isFeedSource,
  type FeedDay,
  type FeedEvent,
  type FeedResponse,
  type FeedSource,
} from "@/lib/calendar/feed-types";

/**
 * Client for the 8 calendar feeds, through `/api/calendar/feed/{source}`.
 *
 * House pattern (see `scheduling.service.ts`): bare `axios` against our own
 * route, with the bearer token read out of `localStorage["auth-token"]`. It
 * deliberately does NOT use `axiosClient`: its baseURL is the auth server, and
 * its 401 interceptor ends the whole session — one testing service answering
 * 401 ("user not synced yet") must not log anyone out.
 *
 * Every source is asked in parallel and judged on its own (guide §2):
 * - 200      → its events
 * - 403      → the user doesn't have that layer: hidden, no message
 * - 401      → failed, UNLESS every source said 401: then the session is over
 * - a 422 naming unknown store numbers → asked again once without them
 * - anything else (422, 5xx, 503 CONFIG_MISSING, timeout, network) → failed,
 *   named in the "couldn't load" note while the rest still renders
 *
 * There is no server cache yet (guide §4), so answers are kept in memory for a
 * minute and a request is served by any fresh answer whose range covers it —
 * the page, the Today panel and the date picker would otherwise ask the same
 * services several times on every load.
 */

const TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 60_000;
/**
 * Daily counts (the Year view) are kept longer: past days don't change, and the
 * guide asks to re-ask only when the stores or the year change (YEAR.md §5).
 */
const GROUP_CACHE_TTL_MS = 15 * 60_000;

/** `NEXT_PUBLIC_CALENDAR_SOURCES=inventory,maintenance` → only those feeds. Default: all 8. */
export const ENABLED_FEED_SOURCES: readonly FeedSource[] = (() => {
  const raw = process.env.NEXT_PUBLIC_CALENDAR_SOURCES ?? "";
  const picked = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isFeedSource);
  return picked.length ? FEED_SOURCES.filter((s) => picked.includes(s)) : FEED_SOURCES;
})();

export interface FeedQuery {
  /** `store_number`s (e.g. "03795-00001"). */
  stores: readonly string[];
  /** Inclusive `YYYY-MM-DD` bounds. */
  from: string;
  to: string;
  /** "day": counts per store and day instead of events (up to 371 days). */
  group?: "day";
}

type Outcome =
  | { state: "ok"; events: FeedEvent[]; days: FeedDay[]; truncated: boolean }
  | { state: "forbidden" }
  | { state: "unauthorized" }
  /** `unknownStores`: a 422 naming store numbers this source doesn't know. */
  | { state: "failed"; unknownStores?: string[] };

export interface FeedsResult {
  events: { source: FeedSource; event: FeedEvent }[];
  /** Sources that answered with their events (an empty list counts). */
  loaded: FeedSource[];
  /** Sources that could not be loaded — named in the page's note. */
  failed: FeedSource[];
  /** Some source hit its event cap (`meta.truncated`): the range should be narrowed. */
  truncated: boolean;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

/** Same as `handleUnauthorized` in scheduling.service: clear the session and go to login. */
function endSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("auth-token");
  localStorage.removeItem("auth-user");
  if (!window.location.pathname.includes("/auth")) {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const locale = ["en", "ar"].includes(parts[0]) ? parts[0] : "en";
    window.location.href = `/${locale}/auth/login`;
  }
}

/* ── One source, one chunk of stores ── */

const STORE_CODE_G = /\d{5}-\d{5}/g;

/**
 * Store numbers a 422 rejects. v1.8 answers in Laravel's shape
 * (`errors.stores: ["Unknown store: 03795-42069."]`); the contract's coded
 * shape (`error.details.stores`) is read too, for when it ships.
 */
function unknownStoresOf(body: unknown): string[] {
  const b = (body ?? {}) as { errors?: { stores?: unknown }; error?: { details?: { stores?: unknown } } };
  const coded = b.error?.details?.stores;
  if (Array.isArray(coded)) return coded.filter((s): s is string => typeof s === "string");
  const messages = b.errors?.stores;
  if (!Array.isArray(messages)) return [];
  return messages.filter((m): m is string => typeof m === "string").flatMap((m) => m.match(STORE_CODE_G) ?? []);
}

async function requestFeed(source: FeedSource, stores: readonly string[], q: FeedQuery, token: string): Promise<Outcome> {
  try {
    const { data } = await axios.get<FeedResponse>(`/api/calendar/feed/${source}`, {
      params: { stores: stores.join(","), from: q.from, to: q.to, ...(q.group ? { group: q.group } : {}) },
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: TIMEOUT_MS,
    });
    // A 200 that isn't the contract (an HTML error page, a proxy banner) is a failure.
    if (!data) return { state: "failed" };
    if (q.group) {
      if (!Array.isArray(data.days)) return { state: "failed" };
      return { state: "ok", events: [], days: data.days, truncated: !!data.meta?.truncated };
    }
    if (!Array.isArray(data.events)) return { state: "failed" };
    return { state: "ok", events: data.events, days: [], truncated: !!data.meta?.truncated };
  } catch (err) {
    const status = isAxiosError(err) ? (err.response?.status ?? null) : null;
    if (status === 403) return { state: "forbidden" };
    if (status === 401) return { state: "unauthorized" };
    if (status === 422 && isAxiosError(err)) {
      const unknownStores = unknownStoresOf(err.response?.data);
      if (unknownStores.length) return { state: "failed", unknownStores };
    }
    return { state: "failed" };
  }
}

/**
 * One chunk, retried once without the stores the source says it doesn't know:
 * a store that exists in pizzasys but not (yet) in one service must not hide
 * that whole layer for every other store.
 */
async function requestChunk(source: FeedSource, stores: readonly string[], q: FeedQuery, token: string): Promise<Outcome> {
  const first = await requestFeed(source, stores, q, token);
  if (first.state !== "failed" || !first.unknownStores?.length) return first;
  const rest = stores.filter((s) => !first.unknownStores!.includes(s));
  if (!rest.length || rest.length === stores.length) return first;
  return requestFeed(source, rest, q, token);
}

/**
 * One source, every store and day asked: ONE request for the whole range
 * (FRONTEND_CALENDAR_REQUESTS.md). Only more than 50 stores (contract §2) go in
 * several, sent in parallel and joined back into one answer.
 */
async function loadSource(source: FeedSource, q: FeedQuery, token: string): Promise<Outcome> {
  const parts = await Promise.all(chunkStores(q.stores).map((c) => requestChunk(source, c, q, token)));
  if (parts.length === 1) return parts[0];
  for (const state of ["failed", "unauthorized", "forbidden"] as const) {
    if (parts.some((p) => p.state === state)) return { state };
  }
  const ok = parts as Extract<Outcome, { state: "ok" }>[];
  return {
    state: "ok",
    events: ok.flatMap((p) => p.events),
    days: ok.flatMap((p) => p.days),
    truncated: ok.some((p) => p.truncated),
  };
}

/* ── Cache ── */

interface CacheEntry {
  source: FeedSource;
  stores: string;
  from: string;
  to: string;
  /** "" for events, "day" for daily counts: never served for each other. */
  group: string;
  at: number;
  ttl: number;
  promise: Promise<Outcome>;
  /** Set once the request settled with a keepable answer. */
  settled?: Outcome;
}

const cache: CacheEntry[] = [];

/**
 * Forget what one source answered. A write (create an event, finish a task)
 * changes only that source's feed, so the other seven keep their cached answers
 * and the next load re-asks just this one.
 */
export function invalidateFeedSource(source: FeedSource): void {
  for (let i = cache.length - 1; i >= 0; i--) {
    if (cache[i].source === source) cache.splice(i, 1);
  }
}

/** Only answers worth reusing: events and "no access". Failures are always retried. */
const keepable = (o: Outcome) => o.state === "ok" || o.state === "forbidden";

function cached(source: FeedSource, stores: string, q: FeedQuery, reuse: boolean): Promise<Outcome> | null {
  // `reuse`: an answer of any age will do (see `fetchFeeds`), so none is dropped for being old.
  if (!reuse) {
    const now = Date.now();
    for (let i = cache.length - 1; i >= 0; i--) {
      if (now - cache[i].at > cache[i].ttl) cache.splice(i, 1);
    }
  }
  const group = q.group ?? "";
  // In flight for exactly this request, or a settled answer that covers it.
  const hit = cache.find(
    (e) =>
      e.source === source &&
      e.stores === stores &&
      e.group === group &&
      ((e.from === q.from && e.to === q.to) || (e.settled && e.from <= q.from && e.to >= q.to)),
  );
  return hit ? hit.promise : null;
}

function load(source: FeedSource, q: FeedQuery, token: string, force: boolean, reuse: boolean): Promise<Outcome> {
  const stores = [...q.stores].sort().join(",");
  if (!force) {
    const hit = cached(source, stores, q, reuse);
    if (hit) return hit;
  }
  const entry: CacheEntry = {
    source,
    stores,
    from: q.from,
    to: q.to,
    group: q.group ?? "",
    at: Date.now(),
    ttl: q.group ? GROUP_CACHE_TTL_MS : CACHE_TTL_MS,
    promise: loadSource(source, q, token),
  };
  cache.push(entry);
  entry.promise.then((o) => {
    if (keepable(o)) {
      entry.settled = o;
      return;
    }
    const i = cache.indexOf(entry);
    if (i >= 0) cache.splice(i, 1);
  });
  return entry.promise;
}

/** Rejects with an AbortError when `signal` fires; the shared request itself keeps going (it fills the cache). */
function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/* ── Public ── */

/**
 * `force` skips the cache (the user pressed Retry). `reuse` serves every cached
 * answer however old: after a write only the written source was dropped from the
 * cache, so only it is asked again (FRONTEND_CALENDAR_REQUESTS.md §4).
 */
type FetchOpts = { force?: boolean; reuse?: boolean; signal?: AbortSignal };

/**
 * Asks `sources` in parallel and sorts their answers into ok / failed. Null when
 * there is nothing to ask, no token, or every source said 401 (the session then
 * ends — see the header).
 */
async function askAll(
  sources: readonly FeedSource[],
  q: FeedQuery,
  opts: FetchOpts,
): Promise<{ source: FeedSource; outcome: Outcome }[] | null> {
  if (!q.stores.length || !sources.length) return null;
  const token = getToken();
  if (!token) {
    endSession();
    return null;
  }
  const outcomes = await untilAborted(
    Promise.all(sources.map((s) => load(s, q, token, !!opts.force, !!opts.reuse))),
    opts.signal,
  );
  if (outcomes.every((o) => o.state === "unauthorized")) {
    endSession();
    return null;
  }
  return outcomes.map((outcome, i) => ({ source: sources[i], outcome }));
}

/**
 * Every enabled feed for `q`, merged. Events are de-duplicated by `id` (a
 * company-wide announcement comes back once, not once per chunk).
 */
export async function fetchFeeds(q: FeedQuery, opts: FetchOpts = {}): Promise<FeedsResult> {
  const result: FeedsResult = { events: [], loaded: [], failed: [], truncated: false };
  const answers = await askAll(ENABLED_FEED_SOURCES, { ...q, group: undefined }, opts);
  if (!answers) return result;

  const seen = new Set<string>();
  for (const { source, outcome: o } of answers) {
    if (o.state === "ok") {
      result.loaded.push(source);
      if (o.truncated) result.truncated = true;
      for (const event of o.events) {
        if (!event || typeof event.id !== "string" || seen.has(event.id)) continue;
        seen.add(event.id);
        result.events.push({ source, event });
      }
    } else if (o.state === "failed" || o.state === "unauthorized") {
      result.failed.push(source);
    }
  }
  return result;
}

export interface DayCountsResult {
  days: FeedDay[];
  loaded: FeedSource[];
  failed: FeedSource[];
  truncated: boolean;
}

/**
 * Daily counts for the Year view (`group=day`, FRONTEND_CALENDAR_YEAR.md): ONE
 * request per counting source for the whole year and every store — never split
 * into months. Hiring and Notifications are not asked (nothing they send is
 * counted). Same per-source rules as `fetchFeeds`; answers are cached longer.
 */
export async function fetchDayCounts(q: FeedQuery, opts: FetchOpts = {}): Promise<DayCountsResult> {
  const result: DayCountsResult = { days: [], loaded: [], failed: [], truncated: false };
  const sources = ENABLED_FEED_SOURCES.filter((s) => YEAR_SOURCES.includes(s));
  const answers = await askAll(sources, { ...q, group: "day" }, opts);
  if (!answers) return result;

  for (const { source, outcome: o } of answers) {
    if (o.state === "ok") {
      result.loaded.push(source);
      if (o.truncated) result.truncated = true;
      result.days.push(...o.days);
    } else if (o.state === "failed" || o.state === "unauthorized") {
      result.failed.push(source);
    }
  }
  return result;
}
