"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639.98px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Below Tailwind's `sm` the calendar switches to compact layouts (dot cells +
 * agenda, a day strip over one timeline). Server render assumes desktop.
 */
export function useIsCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
