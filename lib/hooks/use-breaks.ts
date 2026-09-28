"use client";

import { useEffect, useState } from "react";
import { useBreaksStore } from "@/lib/store/breaks.store";

/** Poll cadence while a break runs. Seconds, not ms — the API has no rate limit. */
const POLL_MS = 30_000;
/** Don't refetch on focus if we synced this recently. */
const FOCUS_MIN_GAP_MS = 5_000;

/**
 * The ONE owner of break polling. Mounted by the topbar trigger, which lives
 * in AppShell and so stays mounted on every dashboard page.
 *
 * Polling is the milestone detector (the server has no timer of its own), so
 * it only runs while a break is open AND the tab is visible — an idle user's
 * day can't cross a milestone, and a hidden tab catches up on return. No
 * prefetching anywhere: `GET breaks/active` and `GET breaks/day` write rows.
 */
export function useBreaksSync(): void {
  const bootstrap = useBreaksStore((s) => s.bootstrap);
  const refresh = useBreaksStore((s) => s.refresh);
  const running = useBreaksStore((s) => s.active != null);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const catchUp = () => {
      if (document.visibilityState !== "visible") return;
      const { syncedAt, settings } = useBreaksStore.getState();
      if (syncedAt && Date.now() - syncedAt < FOCUS_MIN_GAP_MS) return;
      // Bootstrap failed earlier (e.g. offline) — retry the whole thing.
      void (settings ? refresh() : bootstrap());
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("focus", catchUp);
    };
  }, [refresh, bootstrap]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [running, refresh]);
}

/** Epoch ms that re-renders every `intervalMs` while `enabled`; null before mount. */
export function useNow(enabled: boolean, intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}
