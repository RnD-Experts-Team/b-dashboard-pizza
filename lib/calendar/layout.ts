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

/**
 * All-day first (longest span first), then timed by start, then longer first.
 * Ties go by store, so with several stores shown each store's events stay
 * together instead of interleaving.
 */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const byTime = a.allDay
    ? +b.end - +b.start - (+a.end - +a.start) || +a.start - +b.start
    : +a.start - +b.start || +b.end - +b.start - (+a.end - +a.start);
  return byTime || a.store.code.localeCompare(b.store.code);
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

/** Several events folded into one "+N" block (a crowded overlap cluster). */
export interface OverlapStack {
  /** In start order. Always 2 or more. */
  events: CalendarEvent[];
  start: Date;
  end: Date;
  col: number;
  cols: number;
}

export interface OverlapResult {
  items: OverlapItem[];
  stacks: OverlapStack[];
}

/** Shortest visual block in the hour grid. */
export const MIN_BLOCK_MINUTES = 20;

/**
 * How much an event deserves a card of its own when a crowd has to be folded:
 * my own reminders first (they are the point of a reminder), then what someone
 * made in Toolbox (tasks, events), then what needs action (overdue, missed,
 * maintenance), then everything else; daily routines last.
 */
export function eventPriority(ev: CalendarEvent): number {
  if (ev.feedType === "reminder" || ev.layer === "mine") return 4;
  if (ev.origin === "toolbox" || ev.source === "user") return 3;
  if (ev.category === "maintenance" || ev.status === "overdue" || ev.status === "missed") return 2;
  return ev.routine ? 0 : 1;
}

/**
 * Overlap clusters → a column index per event and a column count per cluster.
 *
 * `maxCols` caps how many side-by-side columns a cluster may use (a day column
 * holds ~3 readable cards; 20 people clocking in at once would be 20 slivers).
 * A cluster that needs more keeps `maxCols - 1` events as cards — the most
 * important first (`eventPriority`), then the earliest — and folds everything
 * else into the last column as "+N" stacks: one per run of events that overlap
 * in time, so a stack never spans a quiet gap. A run of one is just drawn as
 * itself. With `maxCols` 1 a crowded cluster is only stacks.
 */
export function overlapLayout(events: readonly CalendarEvent[], maxCols = Infinity): OverlapResult {
  const cap = Math.max(1, Math.floor(maxCols));
  const sorted = [...events].sort(
    (a, b) => +a.start - +b.start || +b.end - +b.start - (+a.end - +a.start),
  );
  const items: OverlapItem[] = [];
  const stacks: OverlapStack[] = [];
  let cluster: OverlapItem[] = [];
  let columns: number[] = [];
  let clusterEnd = -Infinity;

  const visualEnd = (ev: CalendarEvent) => Math.max(+ev.end, +ev.start + MIN_BLOCK_MINUTES * MINUTE);

  const flush = () => {
    if (columns.length <= cap) {
      for (const it of cluster) it.cols = columns.length;
      items.push(...cluster);
    } else {
      const keep = cap - 1;
      let run: OverlapItem[] = [];
      let runEnd = -Infinity;
      const closeRun = () => {
        if (run.length === 1) {
          run[0].col = keep;
          run[0].cols = cap;
          items.push(run[0]);
        } else if (run.length > 1) {
          stacks.push({
            events: run.map((r) => r.ev),
            start: run[0].ev.start,
            end: new Date(runEnd),
            col: keep,
            cols: cap,
          });
        }
        run = [];
        runEnd = -Infinity;
      };
      // The cards: most important first, then earliest. They are packed into the
      // first `keep` columns again (at most `keep` of them, so each fits).
      const kept = [...cluster]
        .sort((a, b) => eventPriority(b.ev) - eventPriority(a.ev) || +a.ev.start - +b.ev.start)
        .slice(0, keep);
      const ends: number[] = [];
      for (const it of [...kept].sort((a, b) => +a.ev.start - +b.ev.start)) {
        let c = ends.findIndex((end) => end <= +it.ev.start);
        if (c === -1) c = ends.push(0) - 1;
        ends[c] = visualEnd(it.ev);
        it.col = c;
        it.cols = cap;
        items.push(it);
      }
      // Everything else folds, in start order (`cluster` already is).
      const cards = new Set(kept);
      for (const it of cluster) {
        if (cards.has(it)) continue;
        if (run.length && +it.ev.start >= runEnd) closeRun();
        run.push(it);
        runEnd = Math.max(runEnd, visualEnd(it.ev));
      }
      closeRun();
    }
    cluster = [];
    columns = [];
    clusterEnd = -Infinity;
  };

  for (const ev of sorted) {
    const s = +ev.start;
    const e = visualEnd(ev);
    if (s >= clusterEnd) flush();
    let c = columns.findIndex((end) => end <= s);
    if (c === -1) {
      c = columns.length;
      columns.push(e);
    } else columns[c] = e;
    cluster.push({ ev, col: c, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return { items, stacks };
}

/** Unique people across events, in first-seen order. */
export function uniquePeople(events: readonly CalendarEvent[]): string[] {
  const seen = new Set<string>();
  for (const e of events) for (const p of e.people) seen.add(p);
  return [...seen];
}
