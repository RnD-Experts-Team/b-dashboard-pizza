"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

// Flat icon style in a 40×56 box: two rounded triangles whose sides cross in
// an X at the waist (y=28). Symmetric top/bottom, so the per-minute flip is
// seamless.
const OUTLINE =
  "M9 5 L31 5 Q33 5 32.02 6.74 L20 28 L7.98 49.26 Q7 51 9 51 L31 51 Q33 51 32.02 49.26 L20 28 L7.98 6.74 Q7 5 9 5 Z";
// The sand lives in the same triangles inset by ~2.5, leaving a clear gap
// between the outline and the fill.
const TOP_BULB =
  "M12.8 7.5 L27.2 7.5 Q28.72 7.5 27.98 8.8 L20 22.93 L12.02 8.8 Q11.28 7.5 12.8 7.5 Z";
const BOTTOM_BULB =
  "M12.8 48.5 L27.2 48.5 Q28.72 48.5 27.98 47.2 L20 33.07 L12.02 47.2 Q11.28 48.5 12.8 48.5 Z";
const TOP_APEX = 22.93; // where the top sand drains from
const BASE = 48.5; // floor of the bottom bulb
const BULB = 15.4; // usable sand height of each bulb

/** Spring-ish "back out" easing: overshoots a little, then settles. */
const FLIP_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const FLIP_MS = 750;

/**
 * An hourglass that reads two ways:
 *
 *  - running: sand drains through the CURRENT MINUTE, and every time a new
 *    minute starts the glass flips over with a little spring — a tick you can
 *    see from across the room.
 *  - idle:    the top bulb is the allowance still left, the bottom is what's
 *    been used. Past the allowance the sand turns red.
 *
 * The flip is a pure transform: rotate to 180° with a transition, then snap
 * back to 0° with the sand reset — the glass is symmetric, so the snap is
 * invisible. Reduced-motion viewers get no flip and no falling stream.
 */
export function BreakHourglass({
  fill,
  running = false,
  minuteIndex,
  over = false,
  size = 40,
  className,
}: {
  /** 0–1: how much of the sand has fallen to the bottom bulb. */
  fill: number;
  /** Shows the falling stream and enables the per-minute flip. */
  running?: boolean;
  /** Whole minutes elapsed; a change triggers the flip. */
  minuteIndex?: number;
  over?: boolean;
  /** Rendered width in px (height follows the 40:56 glass). */
  size?: number;
  className?: string;
}) {
  const clipId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [flipping, setFlipping] = useState(false);
  const [seenMinute, setSeenMinute] = useState(minuteIndex);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    try {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      // ignore
    }
  }, []);

  // Start the flip in the SAME render the minute changes — doing it in an
  // effect would paint one frame of refilled sand before the glass turns.
  if (minuteIndex !== seenMinute) {
    setSeenMinute(minuteIndex);
    if (
      running &&
      seenMinute != null &&
      minuteIndex != null &&
      minuteIndex > seenMinute &&
      !reducedMotion
    ) {
      setFlipping(true);
    }
  }

  // Safety net in case transitionend never fires (tab hidden mid-flip, etc.).
  useEffect(() => {
    if (!flipping) return;
    const id = window.setTimeout(() => setFlipping(false), FLIP_MS + 150);
    return () => window.clearTimeout(id);
  }, [flipping]);

  // Mid-flip the sand is frozen at "all fallen": rotated 180°, that's a full top.
  const f = flipping ? 1 : Math.min(1, Math.max(0, fill));
  const top = (1 - f) * BULB;
  const bottom = f * BULB;
  const mound = Math.min(3, bottom); // a little peak on the fallen sand
  const showStream = running && !flipping && top > 0.3;

  const sand = over ? "fill-red-500 dark:fill-red-400" : "fill-yellow-500 dark:fill-yellow-400";

  return (
    <div
      data-slot="break-hourglass"
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: (size * 56) / 40 }}
    >
      <svg
        viewBox="0 0 40 56"
        className="h-full w-full overflow-visible"
        style={{
          transformOrigin: "50% 50%",
          transform: flipping ? "rotate(180deg)" : "rotate(0deg)",
          transition: flipping ? `transform ${FLIP_MS}ms ${FLIP_EASE}` : "none",
        }}
        onTransitionEnd={() => setFlipping(false)}
      >
        <defs>
          <clipPath id={`top-${clipId}`}>
            <path d={TOP_BULB} />
          </clipPath>
          <clipPath id={`bottom-${clipId}`}>
            <path d={BOTTOM_BULB} />
          </clipPath>
        </defs>

        {/* Top bulb: sand rests on the apex and sinks toward it as it drains.
            No transition — it steps once a second, a fraction of a pixel. */}
        <g clipPath={`url(#top-${clipId})`}>
          {top > 0 && (
            <rect x="0" y={TOP_APEX - top} width="40" height={top + 1} className={sand} />
          )}
          {/* Three glint stripes, like light on the glass. */}
          <g strokeWidth="1.2" strokeLinecap="round" className="stroke-white/55">
            <line x1="13" y1="11.2" x2="14.8" y2="8.6" />
            <line x1="14.8" y1="13.8" x2="17.4" y2="9.4" />
            <line x1="16.6" y1="16.4" x2="19.8" y2="10.8" />
          </g>
        </g>

        {/* Bottom bulb: a small mound that grows. */}
        <g clipPath={`url(#bottom-${clipId})`}>
          {bottom > 0 && (
            <path
              d={`M0 ${BASE + 1} L0 ${BASE - bottom + mound} Q20 ${BASE - bottom - mound} 40 ${BASE - bottom + mound} L40 ${BASE + 1} Z`}
              className={sand}
            />
          )}
        </g>

        {/* Falling grains through the waist (unclipped, so they cross the X). */}
        {showStream && (
          <line
            x1="20"
            y1={TOP_APEX - 0.5}
            x2="20"
            y2={BASE - bottom}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeDasharray="1.2 2"
            className={cn(
              over ? "stroke-red-500 dark:stroke-red-400" : "stroke-yellow-500 dark:stroke-yellow-400",
              "motion-reduce:hidden"
            )}
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-6.4" dur="0.5s" repeatCount="indefinite" />
          </line>
        )}

        {/* The outline: one thick rounded stroke, sides crossing at the waist. */}
        <path
          d={OUTLINE}
          fill="none"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-foreground"
        />
      </svg>
    </div>
  );
}
