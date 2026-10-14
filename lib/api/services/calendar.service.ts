import { getMockCalendarEvents } from "@/lib/mock/calendar-events.mock";
import {
  createUserEvent,
  deleteUserEvent,
  listUserEvents,
  restoreUserEvent,
  updateUserEvent,
} from "@/lib/mock/calendar-user-events.mock";
import { compareEvents } from "@/lib/calendar/layout";
import type { CalendarEvent, CalendarEventInput, CalendarStoreRef, DateRange } from "@/lib/calendar/types";

/** Artificial latency for exercising loading states (0 = instant). */
const MOCK_LATENCY_MS = 0;

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

/**
 * Calendar service — the ONE seam between the Calendar UI and its data.
 *
 * Today it serves mock data: seeded read-only events (`calendar-events.mock`)
 * merged with the events people create here (`calendar-user-events.mock`,
 * persisted in localStorage). When the backend lands, replace these bodies
 * with calls to internal routes, e.g.
 *   GET    /api/calendar/events?from=…&to=…&store=…
 *   POST   /api/calendar/events
 *   PATCH  /api/calendar/events/:id
 *   DELETE /api/calendar/events/:id
 * and map JSON dates to `Date`. Hooks and components don't change.
 *
 * Every method returns a Promise and may reject; callers surface the error.
 */
export const calendarService = {
  /** Every event overlapping `[range.from, range.to)`, sorted by `compareEvents`. */
  getEvents(range: DateRange, store: CalendarStoreRef | null, signal?: AbortSignal): Promise<CalendarEvent[]> {
    return later(() => {
      const own = listUserEvents().filter((e) => e.start < range.to && e.end > range.from);
      return [...getMockCalendarEvents(range, store), ...own].sort(compareEvents);
    }, signal);
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
