import { getMockCalendarEvents } from "@/lib/mock/calendar-events.mock";
import {
  createUserEvent,
  deleteUserEvent,
  listUserEvents,
  restoreUserEvent,
  updateUserEvent,
} from "@/lib/mock/calendar-user-events.mock";
import { compareEvents } from "@/lib/calendar/layout";
import { addDays, dayKey, DAY } from "@/lib/calendar/dates";
import { toCalendarEvent } from "@/lib/calendar/feed-map";
import { FEED_MAX_DAYS, isStoreCode, type FeedSource } from "@/lib/calendar/feed-types";
import { fetchFeeds } from "@/lib/api/services/calendar-feed.service";
import type { CalendarEvent, CalendarEventInput, CalendarStoreRef, DateRange } from "@/lib/calendar/types";

/** Artificial latency for exercising loading states (0 = instant). */
const MOCK_LATENCY_MS = 0;

/**
 * `NEXT_PUBLIC_CALENDAR_MOCK=true` keeps the seeded demo calendar instead of the
 * live feeds (restart `next dev` after changing it).
 */
export const CALENDAR_MOCK = process.env.NEXT_PUBLIC_CALENDAR_MOCK === "true";

function later<T>(value: () => T, signal?: AbortSignal): Promise<T> {
  if (!MOCK_LATENCY_MS) {
    try {
      return Promise.resolve(value());
    } catch (e) {
      return Promise.reject(e);
    }
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        resolve(value());
      } catch (e) {
        reject(e);
      }
    }, MOCK_LATENCY_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/** The range is too long for the feeds (the year view): only your own events show. */
export type CalendarNotice = "yearNoFeed";

export interface CalendarEventsPage {
  events: CalendarEvent[];
  /** Feeds that could not be loaded this time (the rest still render). */
  failed: FeedSource[];
  /** A feed hit its event cap — some events are missing. */
  truncated: boolean;
  notice?: CalendarNotice;
}

/** Thrown when no feed could be loaded at all (none answered, at least one failed). */
export class CalendarLoadError extends Error {
  constructor(readonly failed: FeedSource[]) {
    super("No calendar feed could be loaded.");
    this.name = "CalendarLoadError";
  }
}

const overlaps = (range: DateRange) => (e: CalendarEvent) => e.start < range.to && e.end > range.from;

/**
 * Calendar service — the ONE seam between the Calendar UI and its data.
 *
 * Read events come from the 8 calendar feeds (`calendar-feed.service.ts` →
 * `/api/calendar/feed/{source}`), merged with the events people create here,
 * which still live in localStorage (`calendar-user-events.mock`) until the
 * Toolbox calendar endpoints are wired (phase 2). With
 * `NEXT_PUBLIC_CALENDAR_MOCK=true` everything comes from the seeded mock.
 *
 * Every method returns a Promise and may reject; callers surface the error.
 */
export const calendarService = {
  /**
   * Every event overlapping `[range.from, range.to)` for `stores`, sorted by
   * `compareEvents`. `stores` is what the calendar shows: the user's picks, or
   * just the dashboard's selected store.
   */
  async getEvents(
    range: DateRange,
    stores: readonly CalendarStoreRef[],
    opts: { signal?: AbortSignal; force?: boolean; reuse?: boolean } = {},
  ): Promise<CalendarEventsPage> {
    const own = () => listUserEvents().filter(overlaps(range));

    if (CALENDAR_MOCK) {
      const events = await later(() => [...getMockCalendarEvents(range, stores[0] ?? null), ...own()].sort(compareEvents), opts.signal);
      return { events, failed: [], truncated: false };
    }

    // Ask one extra day on each side: feed dates are UTC for now (guide §5), so
    // an event near midnight can sit on the neighbouring day. The overlap
    // filter below trims what falls outside the range.
    const days = Math.round((+range.to - +range.from) / DAY);
    if (days + 2 > FEED_MAX_DAYS) {
      // The year view: the feeds have no daily-count mode yet (`group=day`).
      return { events: own().sort(compareEvents), failed: [], truncated: false, notice: "yearNoFeed" };
    }

    const refs = [...new Map(stores.filter((s) => isStoreCode(s.code)).map((s) => [s.code, s])).values()];
    if (!refs.length) return { events: own().sort(compareEvents), failed: [], truncated: false };

    // ONE request per feed for the whole range, however many stores
    // (FRONTEND_CALENDAR_REQUESTS.md): never split by weeks.
    const feeds = await fetchFeeds(
      {
        stores: refs.map((s) => s.code),
        from: dayKey(addDays(range.from, -1)),
        to: dayKey(range.to),
      },
      opts,
    );
    if (!feeds.loaded.length && feeds.failed.length) throw new CalendarLoadError(feeds.failed);

    const ctx = { storeNames: new Map(refs.map((s) => [s.code, s.name])), now: Date.now() };
    const fromFeeds = feeds.events
      .map(({ source, event }) => toCalendarEvent(event, source, ctx))
      .filter((e): e is CalendarEvent => !!e && overlaps(range)(e));

    return {
      events: [...fromFeeds, ...own()].sort(compareEvents),
      failed: feeds.failed,
      truncated: feeds.truncated,
    };
  },

  createEvent(input: CalendarEventInput, store: CalendarStoreRef): Promise<CalendarEvent> {
    return later(() => createUserEvent(input, store));
  },

  updateEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
    return later(() => updateUserEvent(id, input));
  },

  /** Resolves with an opaque snapshot that `restoreEvent` accepts (Undo). */
  deleteEvent(id: string): Promise<unknown> {
    return later(() => deleteUserEvent(id));
  },

  restoreEvent(snapshot: unknown): Promise<void> {
    return later(() => restoreUserEvent(snapshot));
  },
};
