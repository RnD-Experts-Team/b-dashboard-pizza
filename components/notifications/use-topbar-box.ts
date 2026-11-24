"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Where the topbar is on screen, so the bell's drawer and toast stack can sit
 * right under it in every shell layout (classic, inset, floating, top-nav)
 * and follow the sidebar as it collapses.
 *
 * Offsets are logical, in px from the viewport edges:
 * - `top`   — the topbar's bottom edge;
 * - `start` / `end` — the gap between the topbar and the viewport's
 *   inline-start / inline-end edge (0 when the topbar touches it; the floating
 *   layout's padding otherwise). In RTL `end` is the left side.
 * - `rtl` — the page's direction, read from the header.
 */
export interface TopbarBox {
  top: number;
  start: number;
  end: number;
  rtl: boolean;
}

function measure(header: HTMLElement): TopbarBox {
  const rect = header.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const rtl = getComputedStyle(header).direction === "rtl";
  const left = Math.max(0, rect.left);
  const right = Math.max(0, width - rect.right);
  return {
    top: Math.max(0, Math.round(rect.bottom)),
    start: Math.round(rtl ? right : left),
    end: Math.round(rtl ? left : right),
    rtl,
  };
}

function same(a: TopbarBox | null, b: TopbarBox) {
  return !!a && a.top === b.top && a.start === b.start && a.end === b.end && a.rtl === b.rtl;
}

/** Measures the `<header>` that contains `anchorRef` (the bell). */
export function useTopbarBox(anchorRef: RefObject<HTMLElement | null>): TopbarBox | null {
  const [box, setBox] = useState<TopbarBox | null>(null);

  useLayoutEffect(() => {
    const header = anchorRef.current?.closest("header");
    if (!header) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure(header);
        setBox((prev) => (same(prev, next) ? prev : next));
      });
    };

    update();
    // The header resizes when the sidebar collapses or the window changes;
    // the window listener covers moves that don't change its size.
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(document.documentElement);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [anchorRef]);

  return box;
}
