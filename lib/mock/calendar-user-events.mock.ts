/**
 * Mock repository for events people create in the Calendar — the CRUD half of
 * the calendar's mock data (the seeded, read-only events live in
 * `calendar-events.mock.ts`).
 *
 * Persisted to localStorage so created events survive a reload, which is what
 * a backend would give us. Only `lib/api/services/calendar.service.ts` calls
 * this; swap the service to real endpoints and this file can go.
 *
 * Dates are stored as ISO strings and revived as local `Date`s.
 */
import type { CalendarEvent, CalendarEventInput, CalendarStoreRef, CategoryKey } from "@/lib/calendar/types";
import { CATEGORY_KEYS } from "@/lib/calendar/types";

export const USER_EVENTS_STORAGE_KEY = "calendar-user-events";

interface StoredUserEvent {
  id: string;
  title: string;
  category: CategoryKey;
  allDay: boolean;
  start: string;
  end: string;
  store: CalendarStoreRef;
  notes: string;
  /** "other" events only. */
  typeLabel?: string;
  createdAt: string;
  updatedAt: string;
}

function readAll(): StoredUserEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USER_EVENTS_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter(isStored) : [];
  } catch {
    return [];
  }
}

function writeAll(list: StoredUserEvent[]) {
  try {
    window.localStorage.setItem(USER_EVENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota/private mode: the change lives until reload, like an offline write.
    throw new Error("Could not save the event.");
  }
}

function isStored(v: unknown): v is StoredUserEvent {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    typeof e.start === "string" &&
    typeof e.end === "string" &&
    (CATEGORY_KEYS as readonly string[]).includes(e.category as string)
  );
}

function toEvent(s: StoredUserEvent): CalendarEvent {
  return {
    id: s.id,
    category: s.category,
    title: s.title,
    start: new Date(s.start),
    end: new Date(s.end),
    allDay: s.allDay,
    store: s.store,
    people: [],
    notes: s.notes || undefined,
    source: "user",
    typeLabel: s.category === "other" && s.typeLabel ? s.typeLabel : undefined,
  };
}

/** Only "other" keeps a custom type name; switching away clears it. */
function cleanTypeLabel(input: CalendarEventInput): string | undefined {
  const label = input.typeLabel?.trim();
  return input.category === "other" && label ? label : undefined;
}

function newId() {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Every user event (callers filter by range). */
export function listUserEvents(): CalendarEvent[] {
  return readAll().map(toEvent);
}

export function createUserEvent(input: CalendarEventInput, store: CalendarStoreRef): CalendarEvent {
  const now = new Date().toISOString();
  const stored: StoredUserEvent = {
    id: newId(),
    title: input.title.trim(),
    category: input.category,
    allDay: input.allDay,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    store,
    notes: input.notes.trim(),
    typeLabel: cleanTypeLabel(input),
    createdAt: now,
    updatedAt: now,
  };
  writeAll([...readAll(), stored]);
  return toEvent(stored);
}

export function updateUserEvent(id: string, input: CalendarEventInput): CalendarEvent {
  const list = readAll();
  const i = list.findIndex((e) => e.id === id);
  if (i < 0) throw new Error("Event not found.");
  const next: StoredUserEvent = {
    ...list[i],
    title: input.title.trim(),
    category: input.category,
    allDay: input.allDay,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    notes: input.notes.trim(),
    typeLabel: cleanTypeLabel(input),
    updatedAt: new Date().toISOString(),
  };
  list[i] = next;
  writeAll(list);
  return toEvent(next);
}

/** Removes an event and returns its stored record, so Undo can put it back. */
export function deleteUserEvent(id: string): unknown {
  const list = readAll();
  const found = list.find((e) => e.id === id);
  if (!found) throw new Error("Event not found.");
  writeAll(list.filter((e) => e.id !== id));
  return found;
}

/** Undo for `deleteUserEvent` — re-inserts the exact record (same id). */
export function restoreUserEvent(record: unknown) {
  if (!isStored(record)) return;
  const list = readAll().filter((e) => e.id !== record.id);
  writeAll([...list, record]);
}
