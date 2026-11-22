"use client";

import { useEffect, useRef, useState } from "react";
import { screenUsageService } from "@/lib/api/services/screen-usage.service";
import { usageDebug, type ProbeDiagnostics, type RecorderSnapshot } from "@/lib/screen-usage/recorder";
import { liveTotals, type CountedSegment, type LiveTotals } from "@/lib/screen-usage/live-totals";
import type { MyUsageSegment } from "@/lib/screen-usage/types";

/**
 * The signed-in person's Screen Project time TODAY, live to the second:
 *   saved  = their segments ScreensPizza already holds (every tab, every device),
 *   +      = what this page recorded and has not sent yet (the recorder's journal),
 * merged by segment id (this page's copy is the newer one) and counted with the
 * report's own rules (live-totals.ts). So the numbers are the ones the report
 * shows for today, a few seconds early.
 *
 * Read-only: nothing here is sent anywhere or fed back to the recorder, so the
 * view can't change what is recorded. The saved part is re-read after every
 * push of this page and when the day changes.
 */

const TICK_MS = 1_000;
const MS_PER_SECOND = 1_000;
/** The server only corrects a client clock that is off by more than this (ScreenUsageController::store). */
const SKEW_TOLERANCE_MS = 5_000;
const HALF = 2;
const FETCH_MARGIN_MS = 60 * 60_000;

export type CameraNow = "visible" | "no_face" | "covered" | "off";
export type MicNow = "talking" | "open" | "dead" | "off";

export interface MyUsageNow {
  connected: boolean;
  camera: CameraNow;
  mic: MicNow;
}

export interface MyUsageToday {
  totals: LiveTotals;
  now: MyUsageNow;
  /** When these numbers were counted, ms. */
  at: number;
  /** Start of today (local midnight), ms. */
  since: number;
  /** The saved part could not be read: totals cover this page's visit only. */
  savedFailed: boolean;
  lastPush: RecorderSnapshot["lastPush"];
  nextPushAt: number | null;
}

function todayWindow(at: number): { from: number; to: number } {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.getTime(), to: end.getTime() };
}

const shiftIso = (iso: string, ms: number) => (ms === 0 ? iso : new Date(Date.parse(iso) + ms).toISOString());

const CAMERA_RANK: Exclude<CameraNow, "off">[] = ["visible", "no_face", "covered"];

/** What the camera and mic are counted as at this moment, across this page's tiles. */
export function nowState(probes: ProbeDiagnostics[]): MyUsageNow {
  const live = probes.filter((p) => p.connected);
  const cams = live.filter((p) => p.camera?.on).map((p) => p.camera!.state);
  const mics = live.filter((p) => p.mic?.on);
  const camera = CAMERA_RANK.find((state) => cams.includes(state)) ?? "off";
  // First rule that holds wins: speaking, then an open mic with sound, then a dead one.
  const micRules: [MicNow, boolean][] = [
    ["talking", live.some((p) => p.speaking)],
    ["open", mics.some((p) => p.mic!.state === "open")],
    ["dead", mics.length > 0],
  ];
  const mic = micRules.find(([, holds]) => holds)?.[0] ?? "off";
  return { connected: live.length > 0, camera, mic };
}

export function useMyScreenUsageToday(): MyUsageToday | null {
  const [saved, setSaved] = useState<{ day: number; segments: MyUsageSegment[]; offset: number } | null>(null);
  const [savedFailed, setSavedFailed] = useState(false);
  const [view, setView] = useState<MyUsageToday | null>(null);
  const lastPushAt = useRef<number | null>(null);
  const [reload, setReload] = useState(0);
  const [day, setDay] = useState(() => todayWindow(Date.now()).from);

  // Re-read the saved part after each successful push of this page.
  useEffect(
    () =>
      usageDebug.subscribe(() => {
      const push = usageDebug.snapshot().lastPush;
      if (push?.ok && push.at !== lastPushAt.current) {
        lastPushAt.current = push.at;
        setReload((n) => n + 1);
      }
    }),
    [],
  );

  // The saved part: today's segments ScreensPizza holds for this person.
  useEffect(() => {
    const controller = new AbortController();
    const window = todayWindow(day);
    const askedAt = Date.now();
    const load = async () => {
      try {
        const res = await screenUsageService.getMine(
          // A margin either side, so a corrected clock never leaves an edge segment out; it is cut to the day below.
          { from: new Date(window.from - FETCH_MARGIN_MS).toISOString(), to: new Date(window.to + FETCH_MARGIN_MS).toISOString() },
          controller.signal,
        );
        const answeredAt = Date.now();
        // The server's clock at the middle of the round trip, minus ours.
        const skew = res.now - (askedAt + (answeredAt - askedAt) / HALF);
        setSaved({
          day,
          segments: res.segments,
          offset: Math.abs(skew) > SKEW_TOLERANCE_MS ? Math.round(skew) : 0,
        });
        setSavedFailed(false);
      } catch {
        if (!controller.signal.aborted) setSavedFailed(true);
      }
    };
    void load();
    return () => controller.abort();
  }, [day, reload]);

  // Every second: saved + this page's unsent segments, counted for today.
  useEffect(() => {
    const update = () => {
      const snap = usageDebug.snapshot();
      const window = todayWindow(snap.now);
      if (window.from !== day) {
        setDay(window.from);
        return;
      }
      const base = saved && saved.day === day ? saved : null;
      const offset = base?.offset ?? 0;
      const byId = new Map<string, CountedSegment>(base?.segments.map((s) => [s.id.toLowerCase(), s]) ?? []);
      [...snap.delivered, ...snap.pending].forEach((s) => {
        // As the server will save it: talking capped at the segment's whole seconds (ScreenUsageController::store).
        const seconds = Math.trunc((Date.parse(s.ended_at) - Date.parse(s.started_at)) / MS_PER_SECOND);
        byId.set(s.id.toLowerCase(), {
          ...s,
          started_at: shiftIso(s.started_at, offset),
          ended_at: shiftIso(s.ended_at, offset),
          talking_seconds: Math.min(s.talking_seconds, seconds),
        });
      });
      setView({
        totals: liveTotals([...byId.values()], { from: window.from + offset, to: window.to + offset }),
        now: nowState(snap.probes),
        at: snap.now,
        since: window.from,
        savedFailed,
        lastPush: snap.lastPush,
        nextPushAt: snap.nextPushAt,
      });
    };
    update();
    const timer = setInterval(update, TICK_MS);
    return () => clearInterval(timer);
  }, [saved, savedFailed, day]);

  return view;
}
