"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export interface ExpandableSlotProps {
  /** false = the compact row, true = the full post. */
  expanded: boolean;
  /** The compact row or the full post (whichever `expanded` says). */
  children: ReactNode;
}

/** Same feel as the dashboard's detail dialogs: a quick fade and a small zoom in. */
const CONTENT_SECONDS = 0.2;
/** How long the slot grows or shrinks to its new height. */
const HEIGHT_SECONDS = 0.34;

/**
 * Lets you SEE a post expand and fold up.
 *
 * Swapping the compact row for the full post (or back) used to be instant. Here
 * the old one fades out while the new one fades and zooms in (the dashboard
 * dialogs' fade + zoom-in), and the slot itself grows or shrinks to the new
 * height, so everything below glides down or up instead of jumping.
 *
 * The height only animates for the swap: while a post sits still (comments
 * opening, a picture loading) the slot just follows its content. Reduced motion
 * gets a plain fade and no height animation.
 */
export function ExpandableSlot({ expanded, children }: ExpandableSlotProps) {
  const reduceMotion = useReducedMotion();
  const [height, setHeight] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const mounted = useRef(false);

  // The moment `expanded` flips, before the new height is measured.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSwapping(true);
    const timer = window.setTimeout(() => setSwapping(false), HEIGHT_SECONDS * 1000 + 120);
    return () => window.clearTimeout(timer);
  }, [expanded]);

  // The height of whatever is showing now. (React 19: the returned function runs
  // when this element goes away, so the exiting copy never stops the new one.)
  const measure = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    setHeight(element.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const animateHeight = swapping && !reduceMotion;

  return (
    <motion.div
      data-slot="expandable-slot"
      initial={false}
      animate={{ height: height ?? "auto" }}
      transition={
        animateHeight ? { duration: HEIGHT_SECONDS, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }
      }
      // `clip` with a margin: the slot hides what is growing, but a focus or
      // deep-link ring around the post (a few pixels out) is still drawn.
      className="relative overflow-clip [overflow-clip-margin:8px]"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={expanded ? "full" : "compact"}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.99 }}
          transition={{ duration: reduceMotion ? 0.12 : CONTENT_SECONDS, ease: "easeOut" }}
          style={{ transformOrigin: "top center" }}
        >
          <div ref={measure}>{children}</div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
