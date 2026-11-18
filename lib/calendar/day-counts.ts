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
  /**
   * Set by `shiftAttentionToNextDay`: the day ("YYYY-MM-DD") this day's overdue and
   * missed numbers come from — the day before it.
   */
  attentionFrom?: string;
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

/** Items that are overdue or missed — the only thing the Year view colours. */
export const attentionCount = (t: DayTally): number => (t.byStatus.overdue ?? 0) + (t.byStatus.missed ?? 0);

/** A "YYYY-MM-DD" key moved by `delta` days (local calendar days, so no DST drift). */
function shiftDayKey(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const n = new Date(y, m - 1, d + delta);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** A tally without its overdue / missed part (`total` keeps counting the day's own items). */
function withoutAttention(t: DayTally): DayTally {
  const { overdue: _o, missed: _m, ...rest } = t.byStatus;
  return { total: t.total, byStatus: rest };
}

/** `into` + the overdue / missed part of `from`. */
function withAttentionOf(into: DayTally, from: DayTally | undefined): DayTally {
  if (!from) return into;
  const byStatus = { ...into.byStatus };
  if (from.byStatus.overdue) byStatus.overdue = from.byStatus.overdue;
  if (from.byStatus.missed) byStatus.missed = from.byStatus.missed;
  return { total: into.total, byStatus };
}

/**
 * The Year view's reading of "overdue": what was left overdue or missed on a day
 * shows on the NEXT day — the day it is found out (a day's data-entry keys and
 * checks are only looked at the morning after) — so Nov 17 is tinted by what
 * Nov 16 left undone, and a day still running is never red for its own work.
 * Every other number stays on its own day (`total` is the day's own items). The
 * per-store split moves the same way. `keep` drops the days outside the range
 * shown (the request starts one day early so the first day has a day before it).
 */
export function shiftAttentionToNextDay(
  days: ReadonlyMap<string, DayCount>,
  keep: (key: string) => boolean = () => true,
): Map<string, DayCount> {
  const out = new Map<string, DayCount>();
  // Every day with numbers of its own, and every day after one (it receives that day's overdue).
  const keys = new Set<string>(days.keys());
  for (const key of days.keys()) keys.add(shiftDayKey(key, 1));
  for (const key of keys) {
    if (!keep(key)) continue;
    const own = days.get(key);
    const prevKey = shiftDayKey(key, -1);
    const prev = days.get(prevKey);
    const ownBase = own ? withoutAttention(own) : { total: 0, byStatus: {} };
    const tally = withAttentionOf(ownBase, prev);
    const stores = new Map<string, DayTally>();
    for (const [code, t] of own?.stores ?? []) stores.set(code, withoutAttention(t));
    for (const [code, t] of prev?.stores ?? []) {
      if (!attentionCount(t)) continue;
      stores.set(code, withAttentionOf(stores.get(code) ?? { total: 0, byStatus: {} }, t));
    }
    if (tally.total === 0 && attentionCount(tally) === 0) continue;
    out.set(key, { ...tally, stores, attentionFrom: prev && attentionCount(prev) ? prevKey : undefined });
  }
  return out;
}

/** 1 = a little more than nothing … 4 = among the worst days of the range. */
export type HeatLevel = 1 | 2 | 3 | 4;

/**
 * A level for every day that has something overdue or missed; the others get none
 * and stay plain.
 *
 * It is HOW MANY items are overdue or missed, ranked against the other days of the
 * same range: the better half of the days is level 1 (a faint tint), the next
 * quarter level 2, the next 15% level 3, and only the worst 10% reach level 4. So the
 * strong colour is rare and answers "which days stood out?", and a range where every
 * day is alike stays at level 1 instead of one red wall. Not "has any" (almost every
 * past day once 40 stores are counted) and not the share of the day's items (a store
 * that misses its one item every day makes every day 100%, however much else there
 * was). The exact numbers are in the day's peek card.
 */
export function heatLevels(days: ReadonlyMap<string, DayCount>): Map<string, HeatLevel> {
  const rows: HeatRow[] = [];
  for (const [key, day] of days) {
    const n = attentionCount(day);
    // `max`: a shifted day's overdue are the day before's, so they can outnumber its own items.
    if (n > 0) rows.push({ key, n, share: n / Math.max(day.total, n) });
  }
  return rankLevels(rows);
}

/** The same levels from a list of events per day: the Month view tints its date numbers with them. */
export function eventHeatLevels(byDay: ReadonlyMap<string, readonly { status?: string }[]>): Map<string, HeatLevel> {
  const rows: HeatRow[] = [];
  for (const [key, list] of byDay) {
    const n = list.filter((e) => e.status === "overdue" || e.status === "missed").length;
    if (list.length > 0 && n > 0) rows.push({ key, n, share: n / list.length });
  }
  return rankLevels(rows);
}

interface HeatRow {
  key: string;
  /** Overdue or missed items that day. */
  n: number;
  /** Their share of the day's items (only used when there are too few days to rank). */
  share: number;
}

function rankLevels(rows: readonly HeatRow[]): Map<string, HeatLevel> {
  const out = new Map<string, HeatLevel>();
  if (!rows.length) return out;

  // Ranking three days against each other says nothing: use plain thresholds on the share.
  if (rows.length < 4) {
    for (const { key, share } of rows) out.set(key, share >= 0.5 ? 4 : share >= 0.25 ? 3 : share >= 0.1 ? 2 : 1);
    return out;
  }

  const sorted = rows.map((r) => r.n).sort((a, b) => a - b);
  const quantile = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  const [q1, q2, q3] = [quantile(0.5), quantile(0.75), quantile(0.9)];
  for (const { key, n } of rows) out.set(key, n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);
  return out;
}

/** Stores with something overdue or missed that day, the most first. */
export function storesNeedingAttention(day: DayCount): { store: string; count: number }[] {
  return [...day.stores.entries()]
    .map(([store, t]) => ({ store, count: attentionCount(t) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count || a.store.localeCompare(b.store));
}
