import type { FeedDay, FeedDayCounts } from "./feed-types";

/**
 * The Year view's numbers (`group=day`, FRONTEND_CALENDAR_YEAR.md). Pure — no
 * React, no network.
 *
 * Each counting source sends one row per store per day that has something on it
 * (empty days don't come, zero statuses are left out). The rows of every source
 * are added together per day, and kept per store too, so a day can say WHICH
 * stores need attention.
 */

/** Most urgent first. */
export const COUNT_STATUSES = ["overdue", "missed", "in_progress", "pending", "scheduled", "done"] as const;
export type CountStatus = (typeof COUNT_STATUSES)[number];

export interface DayTally {
  total: number;
  byStatus: Partial<Record<CountStatus, number>>;
}

export interface DayCount extends DayTally {
  /** store number → that store's numbers for the day. */
  stores: Map<string, DayTally>;
}

const emptyTally = (): DayTally => ({ total: 0, byStatus: {} });

function addInto(t: DayTally, c: FeedDayCounts) {
  let sum = 0;
  for (const s of COUNT_STATUSES) {
    const n = c[s];
    if (typeof n === "number" && n > 0) {
      t.byStatus[s] = (t.byStatus[s] ?? 0) + n;
      sum += n;
    }
  }
  // `total` is always sent; fall back to the statuses' sum if it isn't.
  t.total += typeof c.total === "number" ? c.total : sum;
}

/** Every source's rows → one entry per day ("YYYY-MM-DD"), with the per-store split. */
export function mergeDays(days: readonly FeedDay[]): Map<string, DayCount> {
  const out = new Map<string, DayCount>();
  for (const d of days) {
    if (!d || typeof d.date !== "string" || !d.counts) continue;
    let day = out.get(d.date);
    if (!day) {
      day = { ...emptyTally(), stores: new Map() };
      out.set(d.date, day);
    }
    addInto(day, d.counts);
    let store = day.stores.get(d.store);
    if (!store) {
      store = emptyTally();
      day.stores.set(d.store, store);
    }
    addInto(store, d.counts);
  }
  return out;
}

/**
 * The day's colour, from its worst status: something overdue or missed, then
 * something running, then something still open, otherwise all done.
 */
export type DayHeat = "attention" | "active" | "open" | "done";

export function dayHeat(t: DayTally): DayHeat | null {
  if (t.total <= 0) return null;
  const s = t.byStatus;
  if (s.overdue || s.missed) return "attention";
  if (s.in_progress) return "active";
  if (s.pending || s.scheduled) return "open";
  return "done";
}

/** Stores with something overdue or missed that day, the most first. */
export function storesNeedingAttention(day: DayCount): { store: string; count: number }[] {
  return [...day.stores.entries()]
    .map(([store, t]) => ({ store, count: (t.byStatus.overdue ?? 0) + (t.byStatus.missed ?? 0) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.store.localeCompare(b.store));
}
