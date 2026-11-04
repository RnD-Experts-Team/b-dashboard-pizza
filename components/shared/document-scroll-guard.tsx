"use client";

import { useEffect } from "react";

/** Android lays a rotated page out a moment after it says it turned, then may shift it again. */
const SETTLE_MS = 350;

/**
 * The app shell is a fixed-height frame with its own inner scroller; the page around it
 * never scrolls (html and body are height 100%, overflow: hidden, so body is a hidden
 * scroll box of its own). Browsers still move it: a scrollIntoView, a focused field near
 * the bottom, or turning a tablet between portrait and landscape. That slides the whole
 * shell up or sideways off the screen, leaves a blank band and nobody can scroll it back.
 * Whenever body, html or the window moves, or the screen turns or resizes, all three are
 * put back at the top-left.
 */
export function DocumentScrollGuard() {
  useEffect(() => {
    let timer: number | undefined;
    const reset = () => {
      [document.body, document.documentElement]
        .filter((el) => el.scrollTop !== 0 || el.scrollLeft !== 0)
        .forEach((el) => el.scrollTo(0, 0));
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    // Scroll events of elements do not bubble: catch them on the way down, keep only the page's own.
    const scrolled = (e: Event) => {
      if (e.target === document || e.target === document.body || e.target === document.documentElement) reset();
    };
    // A turn or resize: now, on the next frame, and once the new layout has settled.
    const resized = () => {
      reset();
      requestAnimationFrame(reset);
      window.clearTimeout(timer);
      timer = window.setTimeout(reset, SETTLE_MS);
    };

    document.addEventListener("scroll", scrolled, { capture: true, passive: true });
    window.addEventListener("resize", resized);
    window.addEventListener("orientationchange", resized);
    screen.orientation?.addEventListener("change", resized);
    window.visualViewport?.addEventListener("resize", resized);
    reset();

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("scroll", scrolled, { capture: true });
      window.removeEventListener("resize", resized);
      window.removeEventListener("orientationchange", resized);
      screen.orientation?.removeEventListener("change", resized);
      window.visualViewport?.removeEventListener("resize", resized);
    };
  }, []);

  return null;
}
