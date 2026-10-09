import type { EmployeeDebriefItem, EmployeeDebriefType } from "@/types/employee-debrief.types";
import { localDayOf } from "./dates";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee debriefs — the range endpoint returns `days: { date: items[] }`. */
/*  Flattened here into a newest-first list, each item tagged with its day.  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface DatedEmployeeDebrief {
  /** The calendar day it was filed under (the range key, else its own date). */
  day: string;
  item: EmployeeDebriefItem;
}

export interface EmployeeDebriefDay {
  date: string;
  items: DatedEmployeeDebrief[];
}

function sortKey(entry: DatedEmployeeDebrief): string {
  return entry.item.createdAt ?? entry.item.date ?? entry.day;
}

export function flattenEmployeeDebriefs(
  days: Record<string, EmployeeDebriefItem[]> | null | undefined,
): DatedEmployeeDebrief[] {
  const seen = new Set<number>();
  const out: DatedEmployeeDebrief[] = [];
  for (const [day, items] of Object.entries(days ?? {})) {
    for (const item of items ?? []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({ day: day || localDayOf(item.date ?? item.createdAt) || "", item });
    }
  }
  return out.sort((a, b) => b.day.localeCompare(a.day) || sortKey(b).localeCompare(sortKey(a)));
}

export function groupByDay(entries: DatedEmployeeDebrief[]): EmployeeDebriefDay[] {
  const byDay = new Map<string, DatedEmployeeDebrief[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  return [...byDay.entries()].map(([date, items]) => ({ date, items }));
}

/** Types that actually occur in the list, most used first — for filter chips. */
export function typesInUse(
  entries: DatedEmployeeDebrief[],
  known: EmployeeDebriefType[] = [],
): { type: EmployeeDebriefType; count: number }[] {
  const counts = new Map<string, { type: EmployeeDebriefType; count: number }>();
  for (const k of known) counts.set(k.slug, { type: k, count: 0 });
  for (const { item } of entries) {
    if (!item.type) continue;
    const cur = counts.get(item.type.slug) ?? { type: item.type, count: 0 };
    cur.count += 1;
    counts.set(item.type.slug, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.type.label.localeCompare(b.type.label));
}

export const UNTYPED = "__none__";
