/**
 * Live totals: the same definitions and arithmetic ScreensPizza's report uses
 * (app/Services/ScreenUsageReport.php: build() + derive()), so the numbers on
 * screen are the numbers the report shows.
 *   - whole seconds: the server stores timestamps without milliseconds;
 *   - every segment is cut to the window, talking pro-rated to the part inside;
 *   - overlapping segments are merged before they are summed;
 *   - talking is capped at the time the mic was open.
 * Every value is in SECONDS.
 */

import type { UsageKind, UsageState, UsageSurface } from "./types";

/** What the maths needs from a segment, saved (server) or not yet sent (this page). */
export interface CountedSegment {
  kind: UsageKind;
  state: UsageState;
  surface: UsageSurface;
  started_at: string;
  ended_at: string;
  talking_seconds: number;
}

type Interval = [number, number];

const MS_PER_SECOND = 1000;

function merge(list: Interval[]): Interval[] {
  return list
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
    .reduce<Interval[]>((out, [a, b]) => {
      const last = out[out.length - 1];
      if (last && a <= last[1]) last[1] = Math.max(last[1], b);
      else out.push([a, b]);
      return out;
    }, []);
}

/** `a` minus `b`; both merged and sorted. */
function subtract(a: Interval[], b: Interval[]): Interval[] {
  return a.flatMap(([start, end]) => {
    const { pieces, cursor } = b
      .filter(([bs, be]) => be > start && bs < end)
      .reduce<{ pieces: Interval[]; cursor: number }>(
        (acc, [bs, be]) => {
          if (bs > acc.cursor) acc.pieces.push([acc.cursor, bs]);
          return { pieces: acc.pieces, cursor: Math.max(acc.cursor, be) };
        },
        { pieces: [], cursor: start },
      );
    return cursor < end ? [...pieces, [cursor, end] as Interval] : pieces;
  });
}

const total = (ivs: Interval[]) => ivs.reduce((s, [a, b]) => s + (b - a), 0);
/** ms → whole seconds, as the server stores timestamps. */
const toSec = (ms: number) => Math.floor(ms / MS_PER_SECOND);

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
  micOff: number;
  talkAll: number;
  pip: number;
}

type ListKey = "session" | "pip" | "visible" | "no_face" | "covered" | "camera" | "mic" | "dead" | "talk_all";

/** Which interval lists a segment belongs to (ScreenUsageReport::build's switch). */
const LISTS_OF: Record<UsageKind, (s: CountedSegment) => ListKey[]> = {
  session: (s) => (s.surface === "pip" ? ["session", "pip"] : ["session"]),
  main: () => [],
  camera: (s) =>
    s.state === "visible" || s.state === "no_face" || s.state === "covered" ? ["camera", s.state] : ["camera"],
  mic: (s) => (s.state === "dead" ? ["mic", "dead"] : ["mic"]),
  talk_all: () => ["talk_all"],
};

/**
 * @param window [from, to) in ms; segments are cut to it. Omit to count every segment whole.
 */
export function liveTotals(segments: CountedSegment[], window?: { from: number; to: number }): LiveTotals {
  const fromS = window ? toSec(window.from) : -Infinity;
  const toS = window ? toSec(window.to) : Infinity;

  const cut = segments
    .map((s) => {
      const start = toSec(Date.parse(s.started_at));
      const end = toSec(Date.parse(s.ended_at));
      const iv: Interval = [Math.max(start, fromS), Math.min(end, toS)];
      // Talking pro-rated to the part inside the window, as the report does.
      const talk = s.kind === "mic" && end > start ? s.talking_seconds * ((iv[1] - iv[0]) / (end - start)) : 0;
      return { s, iv, talk };
    })
    .filter(({ iv }) => iv[1] > iv[0]);

  const pick = (key: ListKey) => merge(cut.filter(({ s }) => LISTS_OF[s.kind](s).includes(key)).map(({ iv }) => [...iv] as Interval));
  const session = pick("session");
  const present = pick("visible");
  const covered = subtract(pick("covered"), present);
  const mic = pick("mic");
  const micOpen = total(mic);
  const talking = Math.round(Math.min(micOpen, cut.reduce((sum, { talk }) => sum + talk, 0)));
  const deadMic = total(pick("dead"));

  return {
    connected: total(session),
    present: total(present),
    noFace: total(subtract(subtract(pick("no_face"), present), covered)),
    covered: total(covered),
    cameraOff: total(subtract(session, pick("camera"))),
    away: total(subtract(session, present)),
    micOpen,
    talking,
    silent: Math.max(0, micOpen - talking - deadMic),
    deadMic,
    micOff: total(subtract(session, mic)),
    talkAll: total(pick("talk_all")),
    pip: total(pick("pip")),
  };
}
