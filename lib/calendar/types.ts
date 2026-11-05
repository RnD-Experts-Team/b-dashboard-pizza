/**
 * Calendar domain types. Pure data — no React, no i18n.
 *
 * Dates are LOCAL wall-clock `Date` objects; a day's identity is its
 * "YYYY-MM-DD" key (`dayKey`). An all-day event's `end` is the midnight AFTER
 * its last day, so a 3-day event is [Mon 00:00, Thu 00:00).
 */

import type { FeedCounts, FeedSource } from "./feed-types";

export const CALENDAR_VIEWS = ["day", "week", "month", "year"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/**
 * Order matters: it is the order of the tabs and the filter list, and the day
 * dots take the first 3 present — so the types a manager acts on come first.
 * Feed types map onto these in `feed-map.ts`.
 */
export const CATEGORY_KEYS = [
  "maintenance",
  "shift",
  "cleaning",
  "dough",
  "data",
  "inventory",
  "tasks",
  "reminders",
  "sales",
  "birthday",
  "milestone",
  "meeting",
  /** Anything else; an event may carry its own name for it (`typeLabel`). */
  "other",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** The feed's unified statuses (computed by each source, never here). */
export const EVENT_STATUSES = [
  "scheduled",
  "pending",
  "in_progress",
  "done",
  "overdue",
  "missed",
  "cancelled",
  "info",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** The three statuses the mock cleaning tasks use. */
export type CleaningStatus = Extract<EventStatus, "pending" | "done" | "overdue">;

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
  /** Computed by the event's source (feed events), or the mock cleaning status. */
  status?: EventStatus;
  /** Daily routine: kept out of overview dots so they stay meaningful. */
  routine?: boolean;
  /* ── Feed events only (`feed-map.ts`) ── */
  /** The service that sent it. */
  origin?: FeedSource;
  /** The feed's own `type` (e.g. "tech_visit") and `layer`. */
  feedType?: string;
  layer?: string;
  /** The source's suggested page — resolved through `feedHref`, never used raw. */
  link?: string;
  /** Summary events: the day's numbers. */
  counts?: FeedCounts;
  /** Type-specific details; any key may be missing. */
  extra?: Record<string, unknown>;
  /** No store (announcements, my reminders): shown once, in every store scope. */
  companyWide?: boolean;
  /** Timed event with no end yet (still on the clock, visit with only a start): `end` is a stand-in. */
  openEnded?: boolean;
  /**
   * A roll-up of the same kind of event from several stores (`grouping.ts`):
   * drawn as ONE chip and listed in a peek card. Built for display only; it is
   * never stored and never reaches the feeds or the editor.
   */
  members?: readonly CalendarEvent[];
  /** Toolbox events and tasks: who they are for (`extra.scope` — custom, public or private). */
  scope?: "custom" | "public" | "private";
  /**
   * The feed's `people` of kind `user`, with their ids (`people` above keeps only
   * the names). Toolbox lists the item's creator here; `canCancel` reads it.
   */
  users?: readonly { id: string; name: string }[];
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
