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

/** What the report reads back (UTC ISO strings). */
export interface UsageSegment {
  id: string;
  station_id: number | null;
  user_id: number;
  user_name: string | null;
  kind: UsageKind;
  state: UsageState;
  surface: UsageSurface;
  started_at: string;
  ended_at: string;
  talking_seconds: number;
  end_reason: string | null;
}

export interface UsageStation {
  id: number;
  name: string;
  room_name: string;
  type: string;
}

export interface UsageSegmentsResponse {
  stations: UsageStation[];
  segments: UsageSegment[];
}
