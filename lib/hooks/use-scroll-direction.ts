"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks scroll direction of the app's main scrollable region.
 *
 * Relies on AppShell (components/layout/app-shell.tsx) always rendering
 * exactly one <main> element as the scroll container — html/body are
 * `overflow: hidden` (see app/globals.css), so `<main>` is the only thing
 * that actually scrolls. If that structure changes, update the selector here.
 */
export function useScrollDirection(threshold = 8): "up" | "down" {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const lastScrollTop = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    lastScrollTop.current = main.scrollTop;

    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const scrollTop = main.scrollTop;

        if (scrollTop <= threshold) {
          setDirection("up");
        } else {
          const delta = scrollTop - lastScrollTop.current;
          if (Math.abs(delta) > threshold) {
            setDirection(delta > 0 ? "down" : "up");
            lastScrollTop.current = scrollTop;
          }
        }

        ticking.current = false;
      });
    };

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return direction;
}
