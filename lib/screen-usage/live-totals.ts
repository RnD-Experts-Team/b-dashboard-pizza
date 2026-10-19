/**
 * Live totals for the debug panel: the same definitions ScreensPizza's report
 * uses (app/Services/ScreenUsageReport.php), computed from what this page has
 * recorded so far — so the panel shows the numbers the report will show.
 * Every value is in SECONDS.
 */

import type { DebugSegment } from "./recorder";

type Interval = [number, number];

function merge(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function subtract(a: Interval[], b: Interval[]): Interval[] {
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

const total = (ivs: Interval[]) => ivs.reduce((s, [a, b]) => s + (b - a), 0) / 1000;

export interface LiveTotals {
  connected: number;
  present: number;
  noFace: number;
  covered: number;
  cameraOff: number;
  away: number;
  micOpen: number;
  talking: number;
  silent: number;
  deadMic: number;
  talkAll: number;
  pip: number;
}

export function liveTotals(segments: DebugSegment[]): LiveTotals {
  const pick = (f: (s: DebugSegment) => boolean) =>
    merge(segments.filter(f).map((s) => [Date.parse(s.started_at), Date.parse(s.ended_at)] as Interval));

  const connected = pick((s) => s.kind === "session");
  const present = pick((s) => s.kind === "camera" && s.state === "visible");
  const covered = subtract(pick((s) => s.kind === "camera" && s.state === "covered"), present);
  const noFace = subtract(subtract(pick((s) => s.kind === "camera" && s.state === "no_face"), present), covered);
  const camera = pick((s) => s.kind === "camera");
  const mic = pick((s) => s.kind === "mic");
  const dead = pick((s) => s.kind === "mic" && s.state === "dead");
  const micOpen = total(mic);
  const talking = Math.min(
    micOpen,
    segments.filter((s) => s.kind === "mic").reduce((sum, s) => sum + s.talking_seconds, 0),
  );
  const deadMic = total(dead);

  return {
    connected: total(connected),
    present: total(present),
    noFace: total(noFace),
    covered: total(covered),
    cameraOff: total(subtract(connected, camera)),
    away: total(subtract(connected, present)),
    micOpen,
    talking,
    silent: Math.max(0, micOpen - talking - deadMic),
    deadMic,
    talkAll: total(pick((s) => s.kind === "talk_all")),
    pip: total(pick((s) => s.kind === "session" && s.surface === "pip")),
  };
}
