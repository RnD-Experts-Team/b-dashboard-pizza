import { groupAllDay, needsAction } from "./grouping";
import { CATEGORY_KEYS, type CalendarEvent, type CategoryKey } from "./types";

/**
 * A day's full list, for the Month view's day panel. Pure — no React, no DOM.
 *
 * One day can hold 150+ events once 39 stores are on screen, so a flat list is
 * unreadable. The list is grouped by category (always in the same order, so a
 * category sits in the same place from day to day) and, inside it, the same kind
 * of event from several stores is ONE item — the same roll-up the all-day chips
 * use (`groupAllDay`) — that opens to its stores. Whatever needs attention comes
 * first inside each category, and every header carries its red count.
 */
export interface AgendaSection {
  category: CategoryKey;
  /** Roll-ups (`members` set) and single events. */
  items: CalendarEvent[];
  /** Events behind the items: a roll-up counts all its members. */
  total: number;
  /** Of those, overdue or missed. */
  action: number;
}

/** How many events an item stands for. */
export const itemSize = (ev: CalendarEvent): number => ev.members?.length ?? 1;

/** How many of them are overdue or missed. */
export const itemAction = (ev: CalendarEvent): number =>
  ev.members ? ev.members.filter((m) => needsAction(m.status)).length : needsAction(ev.status) ? 1 : 0;

/** Overdue or missed events in a day's list. */
export const actionCount = (events: readonly CalendarEvent[]): number => events.filter((e) => needsAction(e.status)).length;

export function agendaSections(events: readonly CalendarEvent[]): AgendaSection[] {
  // Only all-day events roll up: a timed event keeps its own row (and its time).
  const items = [...groupAllDay(events.filter((e) => e.allDay)), ...events.filter((e) => !e.allDay)];
  const byCategory = new Map<CategoryKey, CalendarEvent[]>();
  for (const ev of items) {
    const list = byCategory.get(ev.category);
    if (list) list.push(ev);
    else byCategory.set(ev.category, [ev]);
  }

  return CATEGORY_KEYS.filter((k) => byCategory.has(k)).map((category) => {
    const list = byCategory
      .get(category)!
      .sort(
        (a, b) =>
          Number(itemAction(b) > 0) - Number(itemAction(a) > 0) ||
          Number(b.allDay) - Number(a.allDay) ||
          +a.start - +b.start ||
          (a.title ?? "").localeCompare(b.title ?? ""),
      );
    return {
      category,
      items: list,
      total: list.reduce((n, ev) => n + itemSize(ev), 0),
      action: list.reduce((n, ev) => n + itemAction(ev), 0),
    };
  });
}
