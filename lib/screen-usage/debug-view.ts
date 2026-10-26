/**
 * What the debug panel shows, reduced from a recorder snapshot. The same shape
 * is sent by a manager's page to an observer in the room, so the observer sees
 * the manager's numbers rather than its own (observer mode records nothing).
 */

import type { DebugSegment, ProbeDiagnostics, RecorderSnapshot } from "./recorder";
import { liveTotals, type LiveTotals } from "./live-totals";

export interface DebugView {
  tabId: string;
  now: number;
  nextPushAt: number | null;
  disconnectPushAt: number | null;
  pushing: boolean;
  lastPush: RecorderSnapshot["lastPush"];
  pendingOpen: number;
  pendingClosed: number;
  deliveredCount: number;
  totals: LiveTotals;
  probes: ProbeDiagnostics[];
  /** Newest first, at most `limit`. */
  segments: DebugSegment[];
}

export function toDebugView(snap: RecorderSnapshot, limit: number): DebugView {
  const all = [...snap.delivered, ...snap.pending];
  const open = snap.pending.filter((s) => s.open).length;
  return {
    tabId: snap.tabId,
    now: snap.now,
    nextPushAt: snap.nextPushAt,
    disconnectPushAt: snap.disconnectPushAt,
    pushing: snap.pushing,
    lastPush: snap.lastPush,
    pendingOpen: open,
    pendingClosed: snap.pending.length - open,
    deliveredCount: snap.delivered.length,
    totals: liveTotals(all),
    probes: snap.probes,
    segments: all.sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)).slice(0, limit),
  };
}
