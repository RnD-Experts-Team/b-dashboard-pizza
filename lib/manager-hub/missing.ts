import type { DueItem } from "@/types/cleaning.types";
import type { DueKeyItem } from "@/types/due-key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  What is still missing — counted, never decided.                          */
/*                                                                            */
/*  Statuses come from the servers: cleaning `pending | done | overdue`,     */
/*  debriefs (due keys) `filled`. This file only groups and counts them, so  */
/*  the hub's numbers always agree with the floating panel's own badges.     */
/* ────────────────────────────────────────────────────────────────────────── */

/** One missing thing, with the day the panel must open on to fix it. */
export type MissingEntry =
  | { kind: "debrief"; key: string; date: string; item: DueKeyItem }
  | { kind: "cleaning"; key: string; date: string; item: DueItem };

export interface MissingDay {
  date: string;
  entries: MissingEntry[];
}

export type HubSeverity = "loading" | "clear" | "pending" | "overdue";

export function debriefEntry(item: DueKeyItem, date: string): MissingEntry {
  return { kind: "debrief", key: `d-${date}-${item.keyId}`, date, item };
}

export function cleaningEntry(item: DueItem, date: string): MissingEntry {
  return { kind: "cleaning", key: `c-${item.taskId}-${item.period[0]}-${item.period[1]}`, date, item };
}

export function unfilledDebriefs(items: DueKeyItem[] | null | undefined): DueKeyItem[] {
  return (items ?? []).filter((i) => !i.filled);
}

/** Same rule as the floating panel's badge: anything not done is open. */
export function openTasks(items: DueItem[] | null | undefined): DueItem[] {
  return (items ?? []).filter((i) => i.status !== "done");
}

/** Today's list — overdue cleaning first, then debriefs, then pending cleaning. */
export function todayMissing(
  debriefs: DueKeyItem[] | null | undefined,
  tasks: DueItem[] | null | undefined,
  date: string,
): MissingEntry[] {
  const open = openTasks(tasks);
  return [
    ...open.filter((t) => t.status === "overdue").map((t) => cleaningEntry(t, date)),
    ...unfilledDebriefs(debriefs).map((d) => debriefEntry(d, date)),
    ...open.filter((t) => t.status !== "overdue").map((t) => cleaningEntry(t, date)),
  ];
}

/** Unfilled debriefs per past day, newest day first. Empty days are dropped. */
export function debriefBacklog(
  days: { date: string; items: DueKeyItem[] }[] | null | undefined,
): MissingDay[] {
  return (days ?? [])
    .map((d) => ({ date: d.date, entries: unfilledDebriefs(d.items).map((i) => debriefEntry(i, d.date)) }))
    .filter((d) => d.entries.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Cleaning tasks never done in a past period.
 *
 * A weekly or monthly task shows up on EVERY day of its period, so the range
 * repeats it — each (task, period) pair is counted once, on the LAST day it
 * appeared (the latest day the panel can still complete it for). Periods that
 * are still running on the anchor day are skipped: today's list has them.
 */
export function cleaningBacklog(
  days: { date: string; items: DueItem[] }[] | null | undefined,
  anchor: string,
): MissingDay[] {
  const latest = new Map<string, { date: string; item: DueItem }>();
  const doneKeys = new Set<string>();
  for (const day of days ?? []) {
    for (const item of day.items ?? []) {
      const key = `${item.taskId}-${item.period[0]}-${item.period[1]}`;
      if (item.status === "done") {
        doneKeys.add(key);
        continue;
      }
      if (item.period[1] && item.period[1] >= anchor) continue;
      const prev = latest.get(key);
      if (!prev || day.date > prev.date) latest.set(key, { date: day.date, item });
    }
  }
  const byDay = new Map<string, MissingEntry[]>();
  for (const [key, { date, item }] of latest) {
    if (doneKeys.has(key)) continue;
    const list = byDay.get(date) ?? [];
    list.push(cleaningEntry(item, date));
    byDay.set(date, list);
  }
  return [...byDay.entries()]
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Debrief + cleaning backlogs merged into one newest-first list of days. */
export function mergeBacklog(...lists: MissingDay[][]): MissingDay[] {
  const byDay = new Map<string, MissingEntry[]>();
  for (const list of lists) {
    for (const day of list) byDay.set(day.date, [...(byDay.get(day.date) ?? []), ...day.entries]);
  }
  return [...byDay.entries()]
    .map(([date, entries]) => ({ date, entries }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function countEntries(days: MissingDay[]): number {
  return days.reduce((n, d) => n + d.entries.length, 0);
}

export function hubSeverity(input: {
  ready: boolean;
  today: number;
  backlog: number;
  anyOverdueToday: boolean;
}): HubSeverity {
  if (!input.ready) return "loading";
  if (input.backlog > 0 || input.anyOverdueToday) return "overdue";
  if (input.today > 0) return "pending";
  return "clear";
}
