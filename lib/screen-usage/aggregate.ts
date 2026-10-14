/**
 * Screen Project monitoring — pure aggregation of raw usage segments.
 *
 * Segments arrive in UTC; everything here works on epoch ms and buckets with
 * the browser's local Date getters, so hours/days come out in the VIEWER's own
 * time zone. No React.
 *
 * Definitions (decided with the business):
 *  - on screen  = connected to at least one station (union of session segments)
 *  - present    = a face in front of the camera (union of camera:visible) — the camera decides
 *  - no face    = camera on and uncovered, but nobody in front of it
 *  - away       = on screen but not present (camera off, covered or no face)
 *  - favorite   = station in the big main tile for the most time
 */

import type { UsageSegment, UsageStation } from "./types";

export type Interval = [number, number];

/* ── Interval math ─────────────────────────────────────────────────────── */

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function totalMs(merged: Interval[]): number {
  return merged.reduce((sum, [a, b]) => sum + (b - a), 0);
}

/** a − b, both merged. */
export function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [start, end] of a) {
    let cursor = start;
    for (const [bs, be] of b) {
      if (be <= cursor || bs >= end) continue;
      if (bs > cursor) out.push([cursor, bs]);
      cursor = Math.max(cursor, be);
      if (cursor >= end) break;
    }
    if (cursor < end) out.push([cursor, end]);
  }
  return out;
}

/** Segment clipped to [from, to]; null when it falls outside. */
function clip(seg: UsageSegment, from: number, to: number): Interval | null {
  const a = Math.max(Date.parse(seg.started_at), from);
  const b = Math.min(Date.parse(seg.ended_at), to);
  return b > a ? [a, b] : null;
}

function unionOf(segs: UsageSegment[], from: number, to: number, pick: (s: UsageSegment) => boolean): Interval[] {
  const list: Interval[] = [];
  for (const s of segs) {
    if (!pick(s)) continue;
    const iv = clip(s, from, to);
    if (iv) list.push(iv);
  }
  return mergeIntervals(list);
}

/** Talking seconds, pro-rated when a segment is only partly inside the range. */
function talkingMsOf(segs: UsageSegment[], from: number, to: number, pick: (s: UsageSegment) => boolean): number {
  let ms = 0;
  for (const s of segs) {
    if (!pick(s) || !s.talking_seconds) continue;
    const full = Date.parse(s.ended_at) - Date.parse(s.started_at);
    const iv = clip(s, from, to);
    if (!iv || full <= 0) continue;
    ms += s.talking_seconds * 1000 * ((iv[1] - iv[0]) / full);
  }
  return ms;
}

/* ── Users ─────────────────────────────────────────────────────────────── */

export interface UsageUser {
  id: number;
  name: string;
}

export function usersOf(segments: UsageSegment[]): UsageUser[] {
  const map = new Map<number, string>();
  for (const s of segments) {
    if (!map.has(s.user_id) || (!map.get(s.user_id) && s.user_name)) map.set(s.user_id, s.user_name ?? "");
  }
  return [...map]
    .map(([id, name]) => ({ id, name: name || `#${id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function byUser(segments: UsageSegment[]): Map<number, UsageSegment[]> {
  const map = new Map<number, UsageSegment[]>();
  for (const s of segments) {
    const list = map.get(s.user_id);
    if (list) list.push(s);
    else map.set(s.user_id, [s]);
  }
  return map;
}

/* ── Summary (per manager) ─────────────────────────────────────────────── */

export interface UserSummary {
  user: UsageUser;
  onScreenMs: number;
  presentMs: number;
  coveredMs: number;
  noFaceMs: number;
  awayMs: number;
  micOpenMs: number;
  talkingMs: number;
  deadMicMs: number;
  silentMs: number;
  talkAllMs: number;
  talkAllTalkingMs: number;
  pipMs: number;
  favoriteStationId: number | null;
  favoriteMs: number;
  /** Sessions ended because another login with the same LiveKit identity joined. */
  kicks: number;
}

function presenceOf(segs: UsageSegment[], from: number, to: number) {
  const onScreen = unionOf(segs, from, to, (s) => s.kind === "session");
  const present = unionOf(segs, from, to, (s) => s.kind === "camera" && s.state === "visible");
  const away = subtractIntervals(onScreen, present);
  return { onScreen, present, away };
}

export function summarize(segments: UsageSegment[], from: number, to: number): UserSummary[] {
  const users = new Map(usersOf(segments).map((u) => [u.id, u]));
  const out: UserSummary[] = [];

  for (const [userId, segs] of byUser(segments)) {
    const { onScreen, present, away } = presenceOf(segs, from, to);
    const covered = subtractIntervals(
      unionOf(segs, from, to, (s) => s.kind === "camera" && s.state === "covered"),
      present,
    );
    // Another tile may see the same camera at the same moment: visible wins, then covered.
    const noFace = subtractIntervals(
      subtractIntervals(unionOf(segs, from, to, (s) => s.kind === "camera" && s.state === "no_face"), present),
      covered,
    );
    const micOpen = unionOf(segs, from, to, (s) => s.kind === "mic");
    const deadMic = unionOf(segs, from, to, (s) => s.kind === "mic" && s.state === "dead");
    const talkingMs = Math.min(totalMs(micOpen), talkingMsOf(segs, from, to, (s) => s.kind === "mic"));

    const mainByStation = new Map<number, number>();
    for (const s of segs) {
      if (s.kind !== "main" || s.station_id === null) continue;
      mainByStation.set(s.station_id, 0);
    }
    for (const stationId of mainByStation.keys()) {
      mainByStation.set(
        stationId,
        totalMs(unionOf(segs, from, to, (s) => s.kind === "main" && s.station_id === stationId)),
      );
    }
    let favoriteStationId: number | null = null;
    let favoriteMs = 0;
    for (const [stationId, ms] of mainByStation) {
      if (ms > favoriteMs) {
        favoriteStationId = stationId;
        favoriteMs = ms;
      }
    }

    const micOpenMs = totalMs(micOpen);
    const deadMicMs = totalMs(deadMic);
    out.push({
      user: users.get(userId) ?? { id: userId, name: `#${userId}` },
      onScreenMs: totalMs(onScreen),
      presentMs: totalMs(present),
      coveredMs: totalMs(covered),
      noFaceMs: totalMs(noFace),
      awayMs: totalMs(away),
      micOpenMs,
      talkingMs,
      deadMicMs,
      silentMs: Math.max(0, micOpenMs - talkingMs - deadMicMs),
      talkAllMs: totalMs(unionOf(segs, from, to, (s) => s.kind === "talk_all")),
      talkAllTalkingMs: talkingMsOf(segs, from, to, (s) => s.kind === "talk_all"),
      pipMs: totalMs(unionOf(segs, from, to, (s) => s.kind === "session" && s.surface === "pip")),
      favoriteStationId,
      favoriteMs,
      kicks: segs.filter(
        (s) => s.kind === "session" && s.end_reason === "duplicate_identity" && clip(s, from, to),
      ).length,
    });
  }

  return out.sort((a, b) => b.onScreenMs - a.onScreenMs);
}

/* ── Hours heatmap (weekday × hour, viewer's local time) ───────────────── */

/** [weekday 0=Mon..6=Sun][hour 0..23] → minutes */
export type HourGrid = number[][];

function emptyGrid(): HourGrid {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

function addToGrid(grid: HourGrid, intervals: Interval[]) {
  for (const [a, b] of intervals) {
    let cursor = a;
    while (cursor < b) {
      const d = new Date(cursor);
      const nextHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const end = Math.min(b, nextHour);
      grid[(d.getDay() + 6) % 7][d.getHours()] += (end - cursor) / 60_000;
      cursor = end;
    }
  }
}

export function hourGrids(
  segments: UsageSegment[],
  from: number,
  to: number,
  userId: number | null,
): { present: HourGrid; away: HourGrid } {
  const present = emptyGrid();
  const away = emptyGrid();
  for (const [id, segs] of byUser(segments)) {
    if (userId !== null && id !== userId) continue;
    const p = presenceOf(segs, from, to);
    addToGrid(present, p.present);
    addToGrid(away, p.away);
  }
  return { present, away };
}

/* ── Per-screen breakdown ──────────────────────────────────────────────── */

export interface ScreenRow {
  station: UsageStation;
  mainMs: number;
  micMs: number;
  camMs: number;
  byUser: { user: UsageUser; mainMs: number; micMs: number; camMs: number }[];
}

export function perScreen(
  segments: UsageSegment[],
  stations: UsageStation[],
  from: number,
  to: number,
  userId: number | null,
): ScreenRow[] {
  const users = new Map(usersOf(segments).map((u) => [u.id, u]));
  const grouped = byUser(segments);

  return stations
    .map((station) => {
      const row: ScreenRow = { station, mainMs: 0, micMs: 0, camMs: 0, byUser: [] };
      for (const [id, segs] of grouped) {
        if (userId !== null && id !== userId) continue;
        const here = segs.filter((s) => s.station_id === station.id);
        if (here.length === 0) continue;
        const mainMs = totalMs(unionOf(here, from, to, (s) => s.kind === "main"));
        const micMs = totalMs(unionOf(here, from, to, (s) => s.kind === "mic"));
        const camMs = totalMs(unionOf(here, from, to, (s) => s.kind === "camera"));
        if (mainMs + micMs + camMs === 0) continue;
        row.byUser.push({ user: users.get(id) ?? { id, name: `#${id}` }, mainMs, micMs, camMs });
        row.mainMs += mainMs;
        row.micMs += micMs;
        row.camMs += camMs;
      }
      row.byUser.sort((a, b) => b.mainMs - a.mainMs);
      return row;
    })
    .sort((a, b) => b.mainMs - a.mainMs);
}

/* ── Day timeline (one manager, one local day) ─────────────────────────── */

export type TimelineLane = "session" | "main" | "camera" | "mic" | "talkAll";

export type TimelineState =
  | "page"
  | "pip"
  | "main"
  | "visible"
  | "noFace"
  | "covered"
  | "open"
  | "dead"
  | "talkAll";

export interface TimelineBar {
  lane: TimelineLane;
  state: TimelineState;
  start: number;
  end: number;
  stationId: number | null;
  talkingSeconds: number;
}

export function timeline(segments: UsageSegment[], userId: number, dayStart: number, dayEnd: number) {
  const bars: TimelineBar[] = [];
  const kicks: number[] = [];

  for (const s of segments) {
    if (s.user_id !== userId) continue;
    const iv = clip(s, dayStart, dayEnd);
    if (!iv) continue;
    const base = { start: iv[0], end: iv[1], stationId: s.station_id, talkingSeconds: s.talking_seconds };

    switch (s.kind) {
      case "session":
        bars.push({ ...base, lane: "session", state: s.surface === "pip" ? "pip" : "page" });
        if (s.end_reason === "duplicate_identity" && Date.parse(s.ended_at) <= dayEnd) kicks.push(iv[1]);
        break;
      case "main":
        bars.push({ ...base, lane: "main", state: "main" });
        break;
      case "camera":
        bars.push({
          ...base,
          lane: "camera",
          state: s.state === "covered" ? "covered" : s.state === "no_face" ? "noFace" : "visible",
        });
        break;
      case "mic":
        bars.push({ ...base, lane: "mic", state: s.state === "dead" ? "dead" : "open" });
        break;
      case "talk_all":
        bars.push({ ...base, lane: "talkAll", state: "talkAll" });
        break;
    }
  }

  return { bars, kicks };
}

/* ── Formatting ────────────────────────────────────────────────────────── */

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return ms > 0 ? "<1m" : "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}
