/**
 * Calendar domain types. Pure data — no React, no i18n.
 *
 * Dates are LOCAL wall-clock `Date` objects; a day's identity is its
 * "YYYY-MM-DD" key (`dayKey`). An all-day event's `end` is the midnight AFTER
 * its last day, so a 3-day event is [Mon 00:00, Thu 00:00).
 */

export const CALENDAR_VIEWS = ["day", "week", "month", "year"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CATEGORY_KEYS = [
  "birthday",
  "cleaning",
  "shift",
  "milestone",
  "maintenance",
  "meeting",
  /** Anything else; an event may carry its own name for it (`typeLabel`). */
  "other",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type CleaningStatus = "pending" | "done" | "overdue";

export interface CalendarStoreRef {
  code: string;
  name: string;
}

/** Values interpolated into an i18n title (e.g. `{ name: "Maria" }`). */
export type TitleVars = Record<string, string | number>;

export interface CalendarEvent {
  id: string;
  category: CategoryKey;
  /** Data string from the API. Shown as-is (never translated). */
  title?: string;
  /** Computed titles go through i18n instead (`calendar.ev.*`). */
  titleKey?: "birthday" | "anniversary";
  titleVars?: TitleVars;
  start: Date;
  end: Date;
  allDay: boolean;
  store: CalendarStoreRef;
  people: string[];
  /** Cleaning tasks only. */
  status?: CleaningStatus;
  /** Daily routine: kept out of overview dots so they stay meaningful. */
  routine?: boolean;
  notes?: string;
  meta?: { age?: number; years?: number; role?: string };
  /**
   * "user" = created in the calendar (editable, deletable). Everything else is
   * "system": it comes from another module (cleaning chart, scheduling,
   * people) and is read-only here.
   */
  source?: "system" | "user";
  /** "other" events only: the name the user gave the type (e.g. "Inspection"). */
  typeLabel?: string;
}

/** What the event editor produces (create and update share it). */
export interface CalendarEventInput {
  title: string;
  category: CategoryKey;
  allDay: boolean;
  start: Date;
  /** Exclusive: all-day → midnight after the last day. */
  end: Date;
  notes: string;
  /** "other" only; ignored for every other category. */
  typeLabel?: string;
}

export interface DateRange {
  from: Date;
  /** Exclusive. */
  to: Date;
}

/** "store" = only the selected store's events; "all" = every store. */
export type CalendarScope = "store" | "all";
