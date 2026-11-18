import { isSummaryEvent } from "./feed-map";
import { CATEGORY_KEYS, type CalendarEvent, type CategoryKey, type EventStatus } from "./types";

/**
 * Roll-ups for the all-day row. Pure functions — no React, no DOM.
 *
 * With 39 stores on screen every day carries 39 "Cleaning 0/19" chips, 39 "Dough
 * not confirmed" chips… — hundreds of lines that differ only by store. One chip
 * per KIND ("Cleaning · 39 stores · 12 overdue") says what the day holds; the
 * peek card lists the stores. Events from a single store are never merged.
 */

/** Feed types whose title is a per-store caption ("Dough not confirmed", "LY $8,467"), not content. */
const CAPTION_TYPES = new Set(["dough_plan", "dough_judgement", "daily_sales"]);

/** Fewer stores than this and the events stay separate. */
const MIN_STORES = 2;

/** Separates event ids inside a group's peek id. Event ids never contain a line break. */
const ID_SEPARATOR = "\n";

/** The statuses that need someone to act (the only ones drawn in red). */
export function needsAction(status?: EventStatus): boolean {
  return status === "overdue" || status === "missed";
}

/** Most urgent first. */
const STATUS_RANK: Readonly<Record<EventStatus, number>> = {
  overdue: 0,
  missed: 1,
  in_progress: 2,
  pending: 3,
  scheduled: 4,
  info: 5,
  done: 6,
  cancelled: 7,
};

/** The title only says how this store is doing ("Cleaning 0/19"), so it differs per store and is not grouped on. */
function isCaption(ev: CalendarEvent): boolean {
  return isSummaryEvent(ev) || (!!ev.feedType && CAPTION_TYPES.has(ev.feedType));
}

/** Events that are the same thing in another store share a key; null = never grouped. */
function bucketKey(ev: CalendarEvent): string | null {
  if (ev.source === "user" || ev.companyWide || !ev.store.code) return null;
  return [ev.category, ev.feedType ?? "", isCaption(ev) ? "" : (ev.title ?? ev.titleKey ?? ""), +ev.start, +ev.end].join("|");
}

function storeCount(events: readonly CalendarEvent[]): number {
  return new Set(events.filter((e) => !e.companyWide).map((e) => e.store.code)).size;
}

function rollUp(key: string, members: CalendarEvent[]): CalendarEvent {
  const first = members[0];
  const status = members
    .map((m) => m.status)
    .filter((s): s is EventStatus => !!s)
    .sort((a, b) => STATUS_RANK[a] - STATUS_RANK[b])[0];
  return {
    id: `group:${key}`,
    category: first.category,
    // The same thing in every store (a public "Fire drill", a "dough racks" task) keeps its
    // own name on the chip; a per-store caption doesn't, and the chip names the category.
    title: isCaption(first) ? undefined : first.title,
    start: first.start,
    end: first.end,
    allDay: first.allDay,
    // Several stores: no single name. The chip shows how many instead.
    store: { code: "", name: "" },
    people: [],
    status,
    routine: members.every((m) => m.routine) || undefined,
    origin: first.origin,
    feedType: first.feedType,
    layer: first.layer,
    typeLabel: first.typeLabel,
    source: "system",
    members,
  };
}

/**
 * The same kind of event from several stores → one roll-up event per kind and
 * span. Everything else passes through. The result is ordered by category, so a
 * given kind sits in the same row from day to day (lanes keep insertion order
 * for events that start together).
 */
export function groupAllDay(events: readonly CalendarEvent[]): CalendarEvent[] {
  const buckets = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = bucketKey(ev);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(ev);
    else buckets.set(key, [ev]);
  }

  const out: CalendarEvent[] = [];
  const emitted = new Set<string>();
  for (const ev of events) {
    const key = bucketKey(ev);
    const members = key ? buckets.get(key) : undefined;
    if (!key || !members || storeCount(members) < MIN_STORES) {
      out.push(ev);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    out.push(rollUp(key, members));
  }
  return out.sort(
    (a, b) =>
      CATEGORY_KEYS.indexOf(a.category) - CATEGORY_KEYS.indexOf(b.category) ||
      (a.feedType ?? "").localeCompare(b.feedType ?? ""),
  );
}

export interface GroupStats {
  /** Distinct stores behind the events (company-wide ones don't count). */
  stores: number;
  /** Events that are overdue or missed. */
  action: number;
}

export function groupStats(members: readonly CalendarEvent[]): GroupStats {
  return { stores: storeCount(members), action: members.filter((m) => needsAction(m.status)).length };
}

/** The category every event shares, or null when they differ. */
export function commonCategory(events: readonly CalendarEvent[]): CategoryKey | null {
  const first = events[0]?.category;
  return first && events.every((e) => e.category === first) ? first : null;
}

/** A group's peek id: its members' ids, so any view can open it without a registry. */
export function groupPeekId(members: readonly CalendarEvent[]): string {
  return members.map((m) => m.id).join(ID_SEPARATOR);
}

export function parseGroupPeekId(id: string): string[] {
  return id.split(ID_SEPARATOR).filter(Boolean);
}
