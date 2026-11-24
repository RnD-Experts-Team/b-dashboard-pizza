/**
 * How the pieces of the bell drawer come in.
 *
 * - `build`: the drawer has just opened — the filter chips, day labels and
 *   cards slide in from the inline-end edge one after another, while the
 *   panel itself is still arriving (the first piece starts at 120 ms).
 * - `fade`: anything after that (changing a filter, a new row) — a short fade
 *   and a hair of movement, so the big entrance doesn't replay.
 *
 * Plain tw-animate-css classes (no JS animation), so they cost nothing at rest
 * and switch off under `prefers-reduced-motion`. The slide mirrors in RTL.
 */
export type EnterMode = "build" | "fade";

/** easeOutQuint — fast start, long soft landing. */
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export function enterClass(mode: EnterMode): string {
  return mode === "build"
    ? `animate-in fade-in-0 slide-in-from-right-8 rtl:slide-in-from-left-8 duration-[420ms] ${EASE} fill-mode-backwards motion-reduce:animate-none`
    : "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-backwards motion-reduce:animate-none";
}

const BUILD_START_MS = 120;
const BUILD_STEP_MS = 45;
const BUILD_MAX_STEPS = 10;

/** `animation-delay` for the piece at `index` (0-based, across the whole panel). */
export function enterDelay(mode: EnterMode, index: number): string {
  if (mode === "build") {
    return `${BUILD_START_MS + Math.min(index, BUILD_MAX_STEPS) * BUILD_STEP_MS}ms`;
  }
  return `${Math.min(index, 8) * 25}ms`;
}
