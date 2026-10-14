/**
 * Screen Project usage recorder — a module singleton, no React.
 *
 * Probes open/close segments; the recorder keeps them in memory and reports
 * them to ScreensPizza every 5 minutes, plus once when the page is closed,
 * reloaded or left (`pagehide`). Open segments are re-sent with
 * `ended_at = now`: the server upserts on the id, so a crashed tab loses at
 * most one interval. Switching tabs sends nothing — that would multiply the
 * requests for managers who flip between pages all day.
 *
 * Must never affect the call: every entry point swallows its own errors,
 * nothing is awaited by callers, and the unsent backlog is capped.
 */

import { screenUsageService } from "@/lib/api/services/screen-usage.service";
import type { UsageKind, UsageSegmentReport, UsageState, UsageSurface } from "./types";

const FLUSH_INTERVAL_MS = 5 * 60_000;
const MAX_BATCH = 100; // keepalive bodies are limited to 64 KB
const MAX_BACKLOG = 1000;

interface Entry {
  storeId: string;
  report: Omit<UsageSegmentReport, "ended_at" | "talking_seconds">;
  talkingMs: number;
  /** null while still open */
  endedAt: number | null;
}

const entries = new Map<string, Entry>();
let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

/* ── ULID (Crockford base32: 10 time chars + 16 random chars) ───────────── */

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function ulid(): string {
  let time = Date.now();
  let head = "";
  for (let i = 0; i < 10; i++) {
    head = B32[time % 32] + head;
    time = Math.floor(time / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let tail = "";
  for (const b of bytes) tail += B32[b % 32];
  return head + tail;
}

/* ── Lifecycle ─────────────────────────────────────────────────────────── */

function onPageHide() {
  flush(true);
}

function ensureStarted() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  window.addEventListener("pagehide", onPageHide);
}

function trimBacklog() {
  if (entries.size <= MAX_BACKLOG) return;
  // Drop the oldest closed segments first — open ones are still live.
  for (const [id, e] of entries) {
    if (entries.size <= MAX_BACKLOG) break;
    if (e.endedAt !== null) entries.delete(id);
  }
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export interface OpenSegment {
  storeId: string;
  room: string | null;
  kind: UsageKind;
  state?: UsageState;
  surface: UsageSurface;
}

export const usageRecorder = {
  /** Opens a segment and returns its id (null if anything went wrong). */
  open(seg: OpenSegment): string | null {
    try {
      if (!seg.storeId) return null;
      ensureStarted();
      const id = ulid();
      entries.set(id, {
        storeId: seg.storeId,
        report: {
          id,
          room: seg.room,
          kind: seg.kind,
          state: seg.state ?? null,
          surface: seg.surface,
          started_at: new Date().toISOString(),
          end_reason: null,
        },
        talkingMs: 0,
        endedAt: null,
      });
      trimBacklog();
      return id;
    } catch {
      return null;
    }
  },

  addTalking(id: string | null, ms: number) {
    try {
      const e = id ? entries.get(id) : undefined;
      if (e && e.endedAt === null) e.talkingMs += ms;
    } catch {
      /* never break the call */
    }
  },

  /** Idempotent: closing an already-closed (or unknown) id does nothing. */
  close(id: string | null, endReason?: string) {
    try {
      const e = id ? entries.get(id) : undefined;
      if (!e || e.endedAt !== null) return;
      e.endedAt = Date.now();
      if (endReason) e.report.end_reason = endReason;
    } catch {
      /* never break the call */
    }
  },
};

/* ── Flush ─────────────────────────────────────────────────────────────── */

function snapshot(e: Entry, now: number): UsageSegmentReport {
  const endedAt = e.endedAt ?? now;
  const durationS = Math.max(0, Math.floor((endedAt - Date.parse(e.report.started_at)) / 1000));
  return {
    ...e.report,
    ended_at: new Date(endedAt).toISOString(),
    talking_seconds: Math.min(durationS, Math.round(e.talkingMs / 1000)),
  };
}

function flush(keepalive: boolean) {
  if (entries.size === 0) return;
  if (flushing && !keepalive) return;

  try {
    const now = Date.now();
    const byStore = new Map<string, { ids: string[]; closedIds: string[]; reports: UsageSegmentReport[] }>();
    for (const [id, e] of entries) {
      let group = byStore.get(e.storeId);
      if (!group) byStore.set(e.storeId, (group = { ids: [], closedIds: [], reports: [] }));
      if (group.reports.length >= MAX_BATCH) continue;
      group.ids.push(id);
      if (e.endedAt !== null) group.closedIds.push(id);
      group.reports.push(snapshot(e, now));
    }

    flushing = true;
    const sends = [...byStore].map(([storeId, group]) =>
      screenUsageService
        .reportSegments(storeId, group.reports, keepalive)
        // Sent: closed segments are done; open ones stay and get re-sent later.
        .then(() => group.closedIds.forEach((id) => entries.delete(id)))
        .catch(() => {
          /* keep them for the next flush */
        }),
    );
    Promise.allSettled(sends).finally(() => {
      flushing = false;
    });
  } catch {
    flushing = false;
  }
}
