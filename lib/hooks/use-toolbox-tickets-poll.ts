"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calls `fn` every `ms` while the tab is visible, and once on return to the
 * tab if at least `ms / 2` has passed. Ticket realtime is off by default
 * (TOOLBOX_TICKET_REALTIME_ENABLED), so every tickets page is built on this.
 */
export function usePollWhileVisible(fn: () => void, ms: number, enabled = true) {
  const fnRef = useRef(fn);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    lastRef.current = Date.now();

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      lastRef.current = Date.now();
      fnRef.current();
    };
    const timer = window.setInterval(tick, ms);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRef.current >= ms / 2) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms, enabled]);
}

/** Debounced copy of a value. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [state, setState] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setState(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms, setState]);
  return state;
}
