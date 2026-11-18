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
 * and the page scrolls as a fallback — kept low (360px), because a calendar
 * that scrolls inside itself beats a page-level scroll that leaves the rail
 * column half empty.
 *
 * It keeps checking, because a single measurement at mount is not enough:
 * - the scroller is looked up on EVERY fit — on the first pass `<main>` may not
 *   scroll yet (in dev its stylesheet can land after this effect runs), and the
 *   old "no scroller → give up" left the page unfitted, so the whole shell
 *   scrolled and the calendar's own body never did;
 * - it watches the page's parent and the scroller's content as well as the
 *   scroller, so anything around the page changing height re-fits it;
 * - after sizing, whatever still overflows the scroller (something below the
 *   page in the same scroller) is taken off the page's height.
 */
export function useFitHeight(ref: RefObject<HTMLElement | null>, enabled: boolean, minPx = 360) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.height = "";
      return;
    }

    let sc: HTMLElement | null = null;
    const watched = new Set<Element>();
    const ro = new ResizeObserver(() => fit());
    const watch = (node: Element | null | undefined) => {
      if (node && !watched.has(node)) {
        watched.add(node);
        ro.observe(node);
      }
    };
    const setHeight = (px: number) => {
      if (Math.abs(px - el.getBoundingClientRect().height) > 0.5) el.style.height = `${px}px`;
    };

    function fit() {
      if (!el) return;
      const found = scrollParent(el);
      if (found !== sc) {
        sc = found;
        watch(sc);
        watch(sc?.firstElementChild);
      }
      if (!sc) return; // not scrolling yet: the observers / resize / load bring us back
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
      setHeight(next);
      // Anything still overflowing the scroller (content below the page) comes off the page.
      const over = sc.scrollHeight - sc.clientHeight;
      if (over > 1 && next > minPx) setHeight(Math.max(minPx, next - over));
    }

    watch(el.parentElement);
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    window.addEventListener("load", fit);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("load", fit);
      el.style.height = "";
    };
  }, [ref, enabled, minPx]);
}
