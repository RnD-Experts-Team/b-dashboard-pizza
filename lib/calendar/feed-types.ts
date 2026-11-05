/**
 * Wire types of the unified calendar feed (`calendar-feed/v1`, v1.8 as built).
 * Pure data — shared by the proxy route and the client. No React, no i18n.
 *
 * Every source returns exactly this shape; the dashboard never computes a
 * status, it only maps and draws. Unknown `type`s and `extra` keys may appear
 * at any time (additive changes are allowed in v1) and must be ignored.
 */

/** The 8 services that serve a feed, in the order the client asks them. */
export const FEED_SOURCES = [
  "maintenance",
  "operations",
  "auditapp",
  "data",
  "inventory",
  "hiring",
  "notifications",
  "toolbox",
] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

export function isFeedSource(value: string): value is FeedSource {
  return (FEED_SOURCES as readonly string[]).includes(value);
}

export type FeedStatus =
  | "scheduled"
  | "pending"
  | "in_progress"
  | "done"
  | "overdue"
  | "missed"
  | "cancelled"
  | "info";

export type FeedLayer =
  | "people"
  | "cleaning"
  | "dough"
  | "data"
  | "sales"
  | "maintenance"
  | "inventory"
  | "hr"
  | "company"
  | "tasks"
  | "mine";

export interface FeedPerson {
  kind: "employee" | "user" | "technician";
  id: number | string;
  /** Always short ("Ana L."). */
  name: string;
  role?: string | null;
}

/** Summary events only. `shift_day` adds `employees` and `managers`. */
export type FeedCounts = Partial<Record<"done" | "pending" | "overdue" | "missed" | "in_progress" | "scheduled" | "total" | "employees" | "managers", number>>;

export interface FeedEvent {
  /** `source:type:sourceId[:date]` — stable and unique across sources. */
  id: string;
  type: string;
  layer: FeedLayer | string;
  /** `store_number`, or null for company-wide events (announcements, my reminders). */
  store: string | null;
  /** Ready to show (≤ 120 chars). */
  title: string;
  all_day: boolean;
  /** `YYYY-MM-DD`. UTC for now (v1.8 decision), store-local later. */
  date: string;
  /** Inclusive last day of a spanning event, or null. */
  date_end: string | null;
  /** ISO 8601 UTC (`…Z`), or null for all-day events. */
  start: string | null;
  /** null with a `start` = ongoing or open-ended. */
  end: string | null;
  status: FeedStatus | string;
  people?: FeedPerson[] | null;
  /** Where the source thinks the details live (see `feed-links.ts`). */
  link?: string | null;
  updated_at?: string;
  counts?: FeedCounts | null;
  /** Type-specific details. May be missing. */
  extra?: Record<string, unknown> | null;
}

/** `group=day`: what one store had on one day. Statuses at 0 are left out; `total` is always there. */
export type FeedDayCounts = Partial<Record<"done" | "pending" | "overdue" | "missed" | "in_progress" | "scheduled", number>> & {
  total?: number;
};

/** One row of a `group=day` answer: a store × day with something on it (empty days don't come). */
export interface FeedDay {
  store: string;
  /** `YYYY-MM-DD`. */
  date: string;
  counts: FeedDayCounts;
}

export interface FeedResponse {
  contract: string;
  source: FeedSource | string;
  generated_at?: string;
  range?: { from: string; to: string };
  stores?: { number: string; timezone: string | null }[];
  /** Normal answers. */
  events?: FeedEvent[];
  /** `group=day` answers (FRONTEND_CALENDAR_YEAR.md). */
  group?: "day";
  days?: FeedDay[];
  meta?: { count?: number; truncated?: boolean };
}

/**
 * The sources asked for daily counts (the Year view). Hiring and Notifications
 * only send "for your information" events (birthdays, announcements), which are
 * never counted, so they are not asked (FRONTEND_CALENDAR_YEAR.md §1).
 */
export const YEAR_SOURCES: readonly FeedSource[] = ["maintenance", "operations", "auditapp", "data", "inventory", "toolbox"];

/** Longest window a `group=day` request may ask for, inclusive: a 53-week fiscal year. */
export const FEED_GROUP_MAX_DAYS = 371;

/** Stores per request (contract §2). More than this is split into several requests. */
export const FEED_MAX_STORES = 50;

/** Longest `from`–`to` window one request may ask for, inclusive (contract §2). */
export const FEED_MAX_DAYS = 62;

/** A real store number ("03795-00001"). Anything else is rejected upstream (422 UNKNOWN_STORE). */
const STORE_CODE_RE = /^\d{5}-\d{5}$/;
export const isStoreCode = (value: unknown): value is string => typeof value === "string" && STORE_CODE_RE.test(value);
