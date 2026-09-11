/* ────────────────────────────────────────────────────────────────────────── */
/*  Attendance durations — parsing, formatting, and a FORM-ONLY preview      */
/*                                                                            */
/*  Pure, non-React, no JSX.                                                 */
/*                                                                            */
/*  ⚠ HARD RULE: the read-only attendance card renders the SERVER's           */
/*  `TicketIssueAttendance.durations` and never `computeAttendancePreview`.   */
/*  This module's preview exists only so the create form can show what the    */
/*  numbers will look like before saving. Two independently-computed          */
/*  durations rendered as if both were authoritative is a bug report waiting  */
/*  to happen.                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

import type { AttendanceMinutes } from "@/types/maintenance-tickets.types";

/** The four buckets, as the API spells them (note the snake_case parts_run). */
export type AttendanceBucket = keyof AttendanceMinutes;

export const ATTENDANCE_BUCKETS: AttendanceBucket[] = [
  "work",
  "travel",
  "break",
  "parts_run",
];

export const ATTENDANCE_BUCKET_LABELS: Record<AttendanceBucket, string> = {
  work: "Work",
  travel: "Travel",
  break: "Break",
  parts_run: "Parts run",
};

export const EMPTY_MINUTES: AttendanceMinutes = {
  work: 0,
  travel: 0,
  break: 0,
  parts_run: 0,
};

/** "2h 15m" · "45m" · "3h" · "0m". Never returns null — 0 is a real answer. */
export function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0m";
  const mins = Math.round(total);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Warnings                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type AttendanceWarningKind =
  | "incomplete_pair"
  | "inverted_pair"
  | "implausible_pair"
  | "unknown";

export interface ParsedAttendanceWarning {
  /** The code exactly as it arrived, so it is always recoverable in a title. */
  raw: string;
  kind: AttendanceWarningKind;
  /** Null when the suffix is absent or not one of the four known buckets. */
  bucket: AttendanceBucket | null;
  label: string;
  tone: "warn" | "neutral";
}

function isBucket(value: string): value is AttendanceBucket {
  return (ATTENDANCE_BUCKETS as string[]).includes(value);
}

/**
 * Splits `<kind>:<bucket>` and produces display copy.
 *
 * Degrades along two independent axes, because a swallowed warning means the
 * record looks clean and gets paid:
 *   - unknown KIND    → neutral chip rendering the raw code verbatim
 *   - unknown BUCKET  → keep the known phrasing, substitute the raw token
 */
export function parseAttendanceWarning(raw: string): ParsedAttendanceWarning {
  const idx = raw.indexOf(":");
  const kindToken = idx === -1 ? raw : raw.slice(0, idx);
  const bucketToken = idx === -1 ? "" : raw.slice(idx + 1);

  const bucket = isBucket(bucketToken) ? bucketToken : null;
  // Fall back to the raw token so an unrecognised bucket still names itself.
  const where = bucket ? ATTENDANCE_BUCKET_LABELS[bucket] : bucketToken || "Entry";

  switch (kindToken) {
    case "incomplete_pair":
      return {
        raw,
        kind: "incomplete_pair",
        bucket,
        label: `${where}: only one end recorded — counted as zero`,
        tone: "warn",
      };
    case "inverted_pair":
      return {
        raw,
        kind: "inverted_pair",
        bucket,
        label: `${where}: end is before start — counted as zero`,
        tone: "warn",
      };
    case "implausible_pair":
      return {
        raw,
        kind: "implausible_pair",
        bucket,
        label: `${where}: longer than 24h — clamped to 24h`,
        tone: "warn",
      };
    default:
      // A code this build has never seen. Show it rather than hide it.
      return { raw, kind: "unknown", bucket, label: raw, tone: "neutral" };
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Form preview                                                             */
/*                                                                            */
/*  Mirrors the server rule so the create form can warn BEFORE a save.        */
/* ────────────────────────────────────────────────────────────────────────── */

/** Local `YYYY-MM-DDTHH:mm` strings, exactly as the pickers hold them. */
export interface AttendancePairInput {
  startClock: string;
  endClock: string;
  startTravel: string;
  endTravel: string;
  startBreak: string;
  endBreak: string;
  startPartsRun: string;
  endPartsRun: string;
}

export interface AttendancePreview {
  minutes: AttendanceMinutes;
  /** Same `<kind>:<bucket>` codes the server emits, so one parser renders both. */
  warnings: string[];
}

const MAX_PAIR_MINUTES = 24 * 60;

interface Interval {
  start: number;
  end: number;
}

/**
 * Parses the picker's local datetime string.
 *
 * Deliberately NOT routed through `toRfc3339OrUndefined`: computing from the
 * same local strings the user is looking at avoids an hour of drift across a
 * DST boundary between the preview and what they typed.
 */
function parseLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

interface PairResult {
  minutes: number;
  interval: Interval | null;
  warning: string | null;
}

function evaluatePair(
  bucket: AttendanceBucket,
  startRaw: string,
  endRaw: string
): PairResult {
  const start = parseLocal(startRaw);
  const end = parseLocal(endRaw);

  if (start == null && end == null) {
    return { minutes: 0, interval: null, warning: null };
  }
  // Only one end set — the server counts this as zero and flags it.
  if (start == null || end == null) {
    return { minutes: 0, interval: null, warning: `incomplete_pair:${bucket}` };
  }
  if (end <= start) {
    return { minutes: 0, interval: null, warning: `inverted_pair:${bucket}` };
  }

  const minutes = Math.round((end - start) / 60000);
  if (minutes > MAX_PAIR_MINUTES) {
    return {
      minutes: MAX_PAIR_MINUTES,
      interval: { start, end: start + MAX_PAIR_MINUTES * 60000 },
      warning: `implausible_pair:${bucket}`,
    };
  }
  return { minutes, interval: { start, end }, warning: null };
}

/** Clips an interval to a window, returning null when they do not overlap. */
function clip(interval: Interval, window: Interval): Interval | null {
  const start = Math.max(interval.start, window.start);
  const end = Math.min(interval.end, window.end);
  return end > start ? { start, end } : null;
}

/** Merges overlapping intervals so shared time is only ever subtracted once. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const next = sorted[i];
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end);
    } else {
      merged.push(next);
    }
  }
  return merged;
}

function totalMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start) / 60000, 0);
}

/**
 * Preview of what the server will compute.
 *
 * `work` is NET: the break / travel / parts-run intervals are clipped to the
 * clock window, MERGED (so an overlapping break and travel is subtracted once,
 * not twice), and taken off the clock span. The other three are reported at
 * their full recorded length, because they are their own line items.
 *
 * FORM PREVIEW ONLY — see the file header.
 */
export function computeAttendancePreview(
  input: AttendancePairInput
): AttendancePreview {
  const warnings: string[] = [];

  const clock = evaluatePair("work", input.startClock, input.endClock);
  const travel = evaluatePair("travel", input.startTravel, input.endTravel);
  const brk = evaluatePair("break", input.startBreak, input.endBreak);
  const parts = evaluatePair("parts_run", input.startPartsRun, input.endPartsRun);

  for (const r of [clock, travel, brk, parts]) {
    if (r.warning) warnings.push(r.warning);
  }

  let work = clock.minutes;
  if (clock.interval) {
    const inside = [travel.interval, brk.interval, parts.interval]
      .filter((i): i is Interval => i !== null)
      .map((i) => clip(i, clock.interval as Interval))
      .filter((i): i is Interval => i !== null);
    work = Math.max(0, clock.minutes - totalMinutes(mergeIntervals(inside)));
  }

  return {
    minutes: {
      work: Math.round(work),
      travel: travel.minutes,
      break: brk.minutes,
      parts_run: parts.minutes,
    },
    warnings,
  };
}
