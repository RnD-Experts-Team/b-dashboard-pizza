import { CATEGORY_KEYS, type CalendarEvent, type CategoryKey } from "./types";
import { DAY, MINUTE, addDays, dayKey, isSameDay, startOfDay } from "./dates";

/**
 * Layout engines shared by every view. Pure functions — no React, no DOM.
 *
 * - multi-day span math (`lastDay`, `spanDays`, `dayIndex`)
 * - `byDay`: events grouped by day key; multi-day events land on every day
 * - `lanes`: horizontal lane packing for month rows and all-day rows
 * - `overlapLayout`: overlap clusters for timed events in the hour grid
 */

/* ── Event facts ── */

/** Last calendar day an event touches (all-day `end` is the midnight after it). */
export function lastDay(ev: CalendarEvent): Date {
  return ev.allDay ? startOfDay(new Date(+ev.end - 1)) : startOfDay(ev.start);
}

export function spanDays(ev: CalendarEvent): number {
  return Math.round((+lastDay(ev) - +startOfDay(ev.start)) / DAY) + 1;
}

export function isMultiDay(ev: CalendarEvent): boolean {
  return spanDays(ev) > 1;
}

/** 1-based position of `day` inside a multi-day event. */
export function dayIndex(ev: CalendarEvent, day: Date): number {
  return Math.round((+startOfDay(day) - +startOfDay(ev.start)) / DAY) + 1;
}

export function isPast(ev: CalendarEvent, now: number): boolean {
  return +ev.end < now;
}

export function isLive(ev: CalendarEvent, now: number): boolean {
  return !ev.allDay && +ev.start <= now && now < +ev.end;
}

export function durationMinutes(ev: CalendarEvent): number {
  return Math.round((+ev.end - +ev.start) / MINUTE);
}

/** All-day first (longest span first), then timed by start, then longer first. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.allDay) return +b.end - +b.start - (+a.end - +a.start) || +a.start - +b.start;
  return +a.start - +b.start || +b.end - +b.start - (+a.end - +a.start);
}

/** Group by "YYYY-MM-DD"; multi-day events appear on every day they cover. */
export function byDay(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const last = lastDay(ev);
    for (let d = startOfDay(ev.start); d <= last; d = addDays(d, 1)) {
      const k = dayKey(d);
      const list = map.get(k);
      if (list) list.push(ev);
      else map.set(k, [ev]);
    }
  }
  return map;
}

/** Up to `max` category keys present on a day. Daily routines don't count. */
export function dotCategories(events: readonly CalendarEvent[], max = 3): CategoryKey[] {
  const out: CategoryKey[] = [];
  for (const k of CATEGORY_KEYS) {
    if (out.length >= max) break;
    if (events.some((e) => e.category === k && !e.routine)) out.push(k);
  }
  return out;
}

/** Category → count. Every key is present (0 when absent). */
export function countByCategory(events: readonly CalendarEvent[]): Record<CategoryKey, number> {
  const c = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
  for (const e of events) c[e.category]++;
  return c;
}

/* ── Lane layout (month rows + all-day rows) ── */

export interface LaneItem {
  ev: CalendarEvent;
  /** 0-based first column. */
  col: number;
  span: number;
  lane: number;
  /** Continues from before this segment → square start corner + chevron. */
  before: boolean;
  /** Continues after this segment → square end corner + chevron. */
  after: boolean;
}

export interface LaneMore {
  col: number;
  lane: number;
  count: number;
  key: string;
}

export interface LaneLayout {
  items: LaneItem[];
  more: LaneMore[];
  /** Lanes actually used (≤ maxLanes). */
  lanes: number;
}

/**
 * Lays events out in horizontal lanes across `days`. All-day events span
 * columns (longest first, like Google Calendar); timed events (`includeTimed`)
 * take one column each and fill the free lanes around the bars. With
 * `maxLanes` visible lanes, any column that overflows turns its last lane into
 * "+N more", and bars that cross such a column are split around it.
 */
export function lanes(
  days: readonly Date[],
  events: readonly CalendarEvent[],
  maxLanes: number,
  includeTimed: boolean,
): LaneLayout {
  const n = days.length;
  const first = startOfDay(days[0]);
  const lastCol = startOfDay(days[n - 1]);
  const col = (d: Date) => Math.round((+startOfDay(d) - +first) / DAY);
  const occ: boolean[][] = [];
  const fits = (lane: number, s: number, e: number) => {
    const row = occ[lane];
    if (!row) return true;
    for (let c = s; c <= e; c++) if (row[c]) return false;
    return true;
  };
  const take = (lane: number, s: number, e: number) => {
    if (!occ[lane]) occ[lane] = new Array<boolean>(n).fill(false);
    for (let c = s; c <= e; c++) occ[lane][c] = true;
  };

  type Raw = { ev: CalendarEvent; s: number; e: number; lane: number; before: boolean; after: boolean };
  const raw: Raw[] = [];
  const place = (ev: CalendarEvent, s: number, e: number, before: boolean, after: boolean) => {
    let lane = 0;
    while (!fits(lane, s, e)) lane++;
    take(lane, s, e);
    raw.push({ ev, s, e, lane, before, after });
  };

  events
    .filter((ev) => ev.allDay && ev.start <= lastCol && lastDay(ev) >= first)
    .sort((a, b) => +a.start - +b.start || spanDays(b) - spanDays(a))
    .forEach((ev) => {
      place(
        ev,
        Math.max(0, col(ev.start)),
        Math.min(n - 1, col(lastDay(ev))),
        ev.start < first,
        lastDay(ev) > lastCol,
      );
    });

  if (includeTimed) {
    // Daily routines go last: they only fill lanes left over by real events,
    // so a "Sanitize make line" every day never pushes a meeting into "+N more".
    days.forEach((d, c) => {
      const timed = events.filter((ev) => !ev.allDay && isSameDay(ev.start, d));
      [...timed.filter((ev) => !ev.routine), ...timed.filter((ev) => ev.routine)].forEach((ev) =>
        place(ev, c, c, false, false),
      );
    });
  }

  const L = Math.max(1, maxLanes);
  const overflow = new Array<boolean>(n).fill(false);
  for (const it of raw) {
    if (it.lane >= L) for (let c = it.s; c <= it.e; c++) overflow[c] = true;
  }

  const items: LaneItem[] = [];
  for (const it of raw) {
    let runStart = -1;
    for (let c = it.s; c <= it.e + 1; c++) {
      const visible = c <= it.e && (it.lane < L - 1 || (it.lane === L - 1 && !overflow[c]));
      if (visible && runStart < 0) runStart = c;
      if (!visible && runStart >= 0) {
        items.push({
          ev: it.ev,
          col: runStart,
          span: c - runStart,
          lane: it.lane,
          before: runStart > it.s || it.before,
          after: c - 1 < it.e || it.after,
        });
        runStart = -1;
      }
    }
  }

  const more: LaneMore[] = [];
  for (let c = 0; c < n; c++) {
    if (!overflow[c]) continue;
    const count = raw.filter((it) => it.s <= c && c <= it.e && it.lane >= L - 1).length;
    more.push({ col: c, lane: L - 1, count, key: dayKey(days[c]) });
  }

  return { items, more, lanes: Math.min(L, occ.length) };
}

/* ── Overlap layout (hour grid) ── */

export interface OverlapItem {
  ev: CalendarEvent;
  col: number;
  cols: number;
}

/** Shortest visual block in the hour grid. */
export const MIN_BLOCK_MINUTES = 20;

/** Overlap clusters → a column index per event and a column count per cluster. */
export function overlapLayout(events: readonly CalendarEvent[]): OverlapItem[] {
  const sorted = [...events].sort(
    (a, b) => +a.start - +b.start || +b.end - +b.start - (+a.end - +a.start),
  );
  const out: OverlapItem[] = [];
  let cluster: OverlapItem[] = [];
  let columns: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const it of cluster) it.cols = columns.length;
    cluster = [];
    columns = [];
    clusterEnd = -Infinity;
  };
  for (const ev of sorted) {
    const s = +ev.start;
    const e = Math.max(+ev.end, s + MIN_BLOCK_MINUTES * MINUTE);
    if (s >= clusterEnd) flush();
    let c = columns.findIndex((end) => end <= s);
    if (c === -1) {
      c = columns.length;
      columns.push(e);
    } else columns[c] = e;
    const it: OverlapItem = { ev, col: c, cols: 1 };
    cluster.push(it);
    out.push(it);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}

/** Unique people across events, in first-seen order. */
export function uniquePeople(events: readonly CalendarEvent[]): string[] {
  const seen = new Set<string>();
  for (const e of events) for (const p of e.people) seen.add(p);
  return [...seen];
}
