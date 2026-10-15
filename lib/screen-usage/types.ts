/**
 * Screen Project usage monitoring — shapes shared by the recorder (manager's
 * browser → ScreensPizza) and the monitoring report (ScreensPizza → HQ).
 *
 * One segment = one continuous state. A state change closes the segment and
 * opens a new one; talking is a counter on mic/talk_all segments.
 */

export type UsageKind = "session" | "main" | "camera" | "mic" | "talk_all";

/** camera: visible (face) | no_face | covered — mic/talk_all: open | dead — session/main: null */
export type UsageState = "visible" | "no_face" | "covered" | "open" | "dead" | null;

export type UsageSurface = "page" | "pip";

/** What the browser sends. `room` is the station's LiveKit room (null for talk_all). */
export interface UsageSegmentReport {
  id: string;
  room: string | null;
  kind: UsageKind;
  state: UsageState;
  surface: UsageSurface;
  started_at: string;
  ended_at: string;
  talking_seconds: number;
  end_reason: string | null;
}

/* ── The report (GET /usage/report) — every duration in SECONDS ──────────── */

export interface UsageUserRow {
  user_id: number;
  name: string;
  /** Store numbers the manager was seen in. */
  stores: string[];
  on_screen: number;
  present: number;
  away: number;
  no_face: number;
  covered: number;
  camera_off: number;
  mic_open: number;
  talking: number;
  silent: number;
  dead_mic: number;
  talk_all: number;
  talk_all_talking: number;
  pip: number;
  /** Separate stretches on Screen Project. */
  visits: number;
  /** Sessions cut because another login used the same store's identity. */
  kicks: number;
  last_seen: string;
  favorite: { station_id: number; name: string; store: string | null; seconds: number } | null;
}

export interface UsageStoreRow {
  store: string;
  managers: number;
  on_screen: number;
  present: number;
  talking: number;
  kicks: number;
}

export interface UsageScreenRow {
  station_id: number;
  name: string;
  store: string | null;
  /** Time in the big main tile (all managers). */
  main: number;
  mic: number;
  camera: number;
  managers: number;
}

export interface UsageDayRow {
  /** Local day "YYYY-MM-DD" in the viewer's time zone. */
  date: string;
  on_screen: number;
  present: number;
  talking: number;
  managers: number;
}

export interface UsageReport {
  range: { from: string; to: string; tz: string };
  totals: {
    managers: number;
    on_screen: number;
    present: number;
    away: number;
    no_face: number;
    covered: number;
    mic_open: number;
    talking: number;
    dead_mic: number;
    talk_all: number;
    pip: number;
    visits: number;
    kicks: number;
    screens: number;
    screens_watched: number;
  };
  users: UsageUserRow[];
  stores: UsageStoreRow[];
  screens: UsageScreenRow[];
  days: UsageDayRow[];
  /** [weekday 0=Mon..6=Sun][hour 0..23] → seconds, viewer's clock. */
  hours: { present: number[][]; away: number[][] };
  camera: { present: number; no_face: number; covered: number; off: number };
  mic: { talking: number; silent: number; dead: number; off: number };
  /** Everyone seen in these stores and dates — the manager filter's options. */
  managers: { user_id: number; name: string }[];
}

export interface UsageReportParams {
  /** Store NUMBERS. */
  stores: string[];
  from: string;
  to: string;
  tz: string;
  users?: number[];
}

/* ── One manager's day (GET /usage/timeline) ─────────────────────────────── */

export interface UsageTimelineSegment {
  id: string;
  store: string | null;
  station: string | null;
  kind: UsageKind;
  state: UsageState;
  surface: UsageSurface;
  started_at: string;
  ended_at: string;
  talking_seconds: number;
  end_reason: string | null;
}
