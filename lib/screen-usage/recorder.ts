/**
 * Screen Project usage recorder — a module singleton, no React.
 *
 * Probes open/close segments; the recorder keeps every one of them, with exact
 * timestamps, in a journal that is also saved to localStorage — so nothing
 * between two pushes is lost if the tab crashes, is killed or the browser
 * closes. The whole journal is pushed to ScreensPizza in one request:
 *   - every 5 minutes,
 *   - shortly after a station disconnects (a session segment closes),
 *   - when the page is closed, reloaded or left (`pagehide`).
 * Open segments are pushed with `ended_at` = the moment of the push (what was
 * actually observed so far) and the server extends the same row on the next
 * push, so a segment is one row however long it lasts.
 *
 * Exactness rules:
 *   - every change carries the time it actually happened (`at`), so a state
 *     detected a few samples late is back-dated to when it started;
 *   - talking time comes from LiveKit's speaking events (start/stop
 *     timestamps), never from periodic sampling — background tabs throttle
 *     timers to once a minute, which made sampled counts useless;
 *   - a journal left behind by a closed/crashed tab is adopted on the next
 *     page load: its open segments end at the last moment they were seen
 *     alive, and it is pushed.
 *
 * Must never affect the call: every entry point swallows its own errors and
 * nothing is awaited by callers.
 */

import { screenUsageService } from "@/lib/api/services/screen-usage.service";
import type { UsageKind, UsageSegmentReport, UsageState, UsageSurface } from "./types";

const FLUSH_INTERVAL_MS = 5 * 60_000;
/** After a station disconnects, wait for its sibling tiles to close too, then push once. */
const DISCONNECT_FLUSH_DELAY_MS = 1_500;
/** How often an open segment's "still alive" time is saved. */
const HEARTBEAT_MS = 30_000;
/** A journal whose tab hasn't saved a heartbeat for this long belongs to a dead tab. */
const ORPHAN_AFTER_MS = 3 * 60_000;
/** Open segments longer than this are split so no single row grows unbounded. */
const ROLLOVER_MS = 6 * 60 * 60_000;
const MAX_PER_REQUEST = 500;
const MAX_PER_KEEPALIVE = 120; // keepalive bodies are limited to 64 KB
const MAX_ENTRIES = 3000;
const STORAGE_PREFIX = "screen-usage:journal:";

interface Entry {
  id: string;
  storeId: string;
  room: string | null;
  kind: UsageKind;
  state: UsageState;
  surface: UsageSurface;
  startedAt: number;
  /** null while open */
  endedAt: number | null;
  /** Last moment the segment was known to be open (crash recovery). */
  lastSeenAt: number;
  talkingMs: number;
  /** Set while the manager is speaking into this (mic / talk_all) segment. */
  speakingSince: number | null;
  endReason: string | null;
}

// Declared before anything that builds an id at module load (tabId below).
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const tabId = randomId(12);
const entries = new Map<string, Entry>();
/** Segments split internally (rollover) → their continuation, so callers' old ids keep working. */
const successors = new Map<string, string>();
let started = false;
let disconnectFlushTimer: ReturnType<typeof setTimeout> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

/* ── Ids (ULID: 10 time chars + 16 random chars, Crockford base32) ────── */


function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += B32[b % 32];
  return out;
}

function ulid(at = Date.now()): string {
  let time = at;
  let head = "";
  for (let i = 0; i < 10; i++) {
    head = B32[time % 32] + head;
    time = Math.floor(time / 32);
  }
  return head + randomId(16);
}

/* ── Persistence (per-tab localStorage journal) ─────────────────────────── */

function storageKey(id = tabId) {
  return STORAGE_PREFIX + id;
}

function persistNow() {
  try {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (entries.size === 0) {
      localStorage.removeItem(storageKey());
      return;
    }
    localStorage.setItem(storageKey(), JSON.stringify({ heartbeatAt: Date.now(), entries: [...entries.values()] }));
  } catch {
    /* storage full / blocked — the in-memory journal still works */
  }
}

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(persistNow, 1_000);
}

/** Close what a dead tab left open at the last moment it was seen, and take its journal over. */
function adoptOrphans() {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX) || key === storageKey()) continue;
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as { heartbeatAt: number; entries: Entry[] } | null;
      const tabEnded = saved?.entries.every((e) => e.endedAt !== null) ?? true;
      if (saved && !tabEnded && now - saved.heartbeatAt < ORPHAN_AFTER_MS) continue; // that tab is alive
      for (const e of saved?.entries ?? []) {
        if (e.endedAt === null) {
          e.endedAt = Math.max(e.startedAt, e.lastSeenAt);
          if (e.speakingSince !== null) e.talkingMs += Math.max(0, e.endedAt - e.speakingSince);
          e.speakingSince = null;
          if (e.kind === "session") e.endReason ??= "page_closed";
        }
        entries.set(e.id, e);
      }
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore a corrupt journal */
  }
}

/* ── Lifecycle ─────────────────────────────────────────────────────────── */

function heartbeat() {
  const now = Date.now();
  for (const e of entries.values()) if (e.endedAt === null) e.lastSeenAt = now;
  persistNow();
}

function onPageHide(event: PageTransitionEvent) {
  try {
    if (!event.persisted) {
      // The page is going away for good: everything ends now. The journal is
      // saved first, so whatever the keepalive push doesn't deliver is pushed
      // by the next page load.
      const now = Date.now();
      for (const e of entries.values()) {
        if (e.endedAt !== null) continue;
        endSpeaking(e, now);
        e.endedAt = now;
        e.lastSeenAt = now;
        if (e.kind === "session") e.endReason ??= "page_closed";
      }
    }
    heartbeat();
  } catch {
    /* ignore */
  }
  flush(true);
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  adoptOrphans();
  // Module-lifetime timers: the recorder lives as long as the page.
  setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  setInterval(heartbeat, HEARTBEAT_MS);
  window.addEventListener("pagehide", onPageHide);
  // Push whatever an earlier tab left behind.
  if (entries.size > 0) setTimeout(() => flush(false), 5_000);
}

function trim() {
  if (entries.size <= MAX_ENTRIES) return;
  for (const [id, e] of entries) {
    if (entries.size <= MAX_ENTRIES) break;
    if (e.endedAt !== null) entries.delete(id);
  }
}

function scheduleDisconnectFlush() {
  if (disconnectFlushTimer) clearTimeout(disconnectFlushTimer);
  disconnectFlushTimer = setTimeout(() => {
    disconnectFlushTimer = null;
    flush(false);
  }, DISCONNECT_FLUSH_DELAY_MS);
}

function resolve(id: string | null): Entry | undefined {
  let current = id;
  for (let hops = 0; current && hops < 64; hops++) {
    const next = successors.get(current);
    if (!next) break;
    current = next;
  }
  return current ? entries.get(current) : undefined;
}

function endSpeaking(e: Entry, at: number) {
  if (e.speakingSince === null) return;
  e.talkingMs += Math.max(0, at - e.speakingSince);
  e.speakingSince = null;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export interface OpenSegment {
  storeId: string;
  room: string | null;
  kind: UsageKind;
  state?: UsageState;
  surface: UsageSurface;
  /** When it actually started (default: now). */
  at?: number;
  /** For mic segments: the manager is already speaking. */
  speaking?: boolean;
}

export const usageRecorder = {
  /** Opens a segment and returns its id (null if anything went wrong). */
  open(seg: OpenSegment): string | null {
    try {
      if (!seg.storeId) return null;
      ensureStarted();
      const at = Math.min(seg.at ?? Date.now(), Date.now());
      const id = ulid(at);
      entries.set(id, {
        id,
        storeId: seg.storeId,
        room: seg.room,
        kind: seg.kind,
        state: seg.state ?? null,
        surface: seg.surface,
        startedAt: at,
        endedAt: null,
        lastSeenAt: Date.now(),
        talkingMs: 0,
        speakingSince: seg.speaking ? at : null,
        endReason: null,
      });
      trim();
      persistSoon();
      return id;
    } catch {
      return null;
    }
  },

  /**
   * The segment's state changed at `at` (e.g. camera visible → covered): closes
   * it there and opens its continuation in the new state from the same moment.
   * Returns the new segment's id (the old id if nothing changed).
   */
  transition(id: string | null, state: UsageState, at = Date.now()): string | null {
    try {
      const e = resolve(id);
      if (!e || e.endedAt !== null || e.state === state) return e?.id ?? id;
      const cut = Math.min(Math.max(at, e.startedAt), Date.now());
      const speaking = e.speakingSince !== null;
      endSpeaking(e, cut);
      e.endedAt = cut;
      return usageRecorder.open({ storeId: e.storeId, room: e.room, kind: e.kind, state, surface: e.surface, at: cut, speaking });
    } catch {
      return id;
    }
  },

  /** Exact talking time: call on every speaking start/stop event. */
  setSpeaking(id: string | null, speaking: boolean, at = Date.now()) {
    try {
      const e = resolve(id);
      if (!e || e.endedAt !== null) return;
      if (speaking) e.speakingSince ??= Math.max(at, e.startedAt);
      else endSpeaking(e, at);
      persistSoon();
    } catch {
      /* never break the call */
    }
  },

  /** Idempotent: closing an already-closed (or unknown) id does nothing. */
  close(id: string | null, opts: { endReason?: string; at?: number } = {}) {
    try {
      const e = resolve(id);
      if (!e || e.endedAt !== null) return;
      const at = Math.min(Math.max(opts.at ?? Date.now(), e.startedAt), Date.now());
      endSpeaking(e, at);
      e.endedAt = at;
      e.lastSeenAt = at;
      if (opts.endReason) e.endReason = opts.endReason;
      persistSoon();
      // A station disconnected (or the manager left): push right away.
      if (e.kind === "session") scheduleDisconnectFlush();
    } catch {
      /* never break the call */
    }
  },
};

/* ── Push ──────────────────────────────────────────────────────────────── */

/** Split open segments that have run too long, so each row stays bounded. */
function rollover(now: number) {
  for (const e of [...entries.values()]) {
    if (e.endedAt !== null || now - e.startedAt < ROLLOVER_MS) continue;
    const speaking = e.speakingSince !== null;
    endSpeaking(e, now);
    e.endedAt = now;
    e.endReason ??= e.kind === "session" ? "rollover" : null;
    const next = usageRecorder.open({ storeId: e.storeId, room: e.room, kind: e.kind, state: e.state, surface: e.surface, at: now, speaking });
    if (next) successors.set(e.id, next);
  }
}

function report(e: Entry, now: number): UsageSegmentReport {
  const end = e.endedAt ?? now;
  const talking = e.talkingMs + (e.speakingSince !== null ? Math.max(0, end - e.speakingSince) : 0);
  return {
    id: e.id,
    room: e.room,
    kind: e.kind,
    state: e.state,
    surface: e.surface,
    started_at: new Date(e.startedAt).toISOString(),
    ended_at: new Date(end).toISOString(),
    talking_seconds: Math.min(Math.round((end - e.startedAt) / 1000), Math.round(talking / 1000)),
    end_reason: e.endReason,
  };
}

function flush(keepalive: boolean) {
  if (entries.size === 0) return;
  if (flushing && !keepalive) return;

  try {
    const now = Date.now();
    rollover(now);
    const limit = keepalive ? MAX_PER_KEEPALIVE : MAX_PER_REQUEST;
    const byStore = new Map<string, { sent: Map<string, number | null>; reports: UsageSegmentReport[] }>();
    // Closed segments first: they are final and must not wait behind open ones.
    const ordered = [...entries.values()].sort((a, b) => Number(a.endedAt === null) - Number(b.endedAt === null));
    for (const e of ordered) {
      let group = byStore.get(e.storeId);
      if (!group) byStore.set(e.storeId, (group = { sent: new Map(), reports: [] }));
      if (group.reports.length >= limit) continue;
      group.sent.set(e.id, e.endedAt);
      group.reports.push(report(e, now));
      if (e.endedAt === null) e.lastSeenAt = now;
    }
    persistNow();

    flushing = true;
    const sends = [...byStore].map(([storeId, group]) =>
      screenUsageService
        .reportSegments(storeId, group.reports, new Date(now).toISOString(), keepalive)
        .then(() => {
          // Delivered: closed segments are done; open ones stay and are extended next time.
          for (const [id, endedAt] of group.sent) {
            if (endedAt !== null && entries.get(id)?.endedAt === endedAt) entries.delete(id);
          }
          persistNow();
        })
        .catch(() => {
          /* still in the journal — the next push retries */
        }),
    );
    Promise.allSettled(sends).finally(() => {
      flushing = false;
    });
  } catch {
    flushing = false;
  }
}
