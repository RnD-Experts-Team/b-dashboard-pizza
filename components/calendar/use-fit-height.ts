"use client";

import { useLayoutEffect, type RefObject } from "react";

/** Nearest ancestor that scrolls vertically (the app shell's <main>). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return null;
}

/**
 * Sizes `ref` to exactly the height its scroll container has left, so the
 * page itself never scrolls and only the calendar's own body does — ONE
 * scrollbar instead of a page scrollbar stacked on the calendar's.
 *
 * Measured rather than a `calc(100dvh - Xrem)` guess, because the shell's
 * four layout variants (classic / inset / floating / top-nav) each pad the
 * page differently. Below `minPx` (very short windows) it stops shrinking
 * and the page scrolls as a fallback.
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>, enabled: boolean, minPx = 480) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.height = "";
      return;
    }
    const sc = scrollParent(el);
    if (!sc) return;

    const fit = () => {
      const scRect = sc.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // Where the element starts inside the scroller's content…
      const top = elRect.top - scRect.top + sc.scrollTop - sc.clientTop;
      // …and the space the wrappers leave below it: every bottom padding /
      // border / margin from the element up to (and including) the scroller.
      // Not `scrollHeight - bottom`: when the page is shorter than the
      // window that would count the empty space too and it could never grow.
      let after = parseFloat(getComputedStyle(el).marginBottom) || 0;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        after += (parseFloat(cs.paddingBottom) || 0) + (p === sc ? 0 : (parseFloat(cs.borderBottomWidth) || 0) + (parseFloat(cs.marginBottom) || 0));
        if (p === sc) break;
      }
      const next = Math.max(minPx, Math.floor(sc.clientHeight - top - after));
      if (Math.abs(next - elRect.height) > 0.5) el.style.height = `${next}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(sc);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      el.style.height = "";
    };
  }, [ref, enabled, minPx]);
}
