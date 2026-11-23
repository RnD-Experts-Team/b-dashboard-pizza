"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept live.
 *
 * The existing `components/calendar/use-compact.ts` is hard-wired to the
 * calendar's 640px query, so the announcement panels (Popover on md+, bottom
 * Sheet on phones) get their own small hook. The server snapshot is
 * `serverValue` (phone-first by default); the panels are only ever opened by a
 * user, so there is nothing to mismatch on hydration.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
