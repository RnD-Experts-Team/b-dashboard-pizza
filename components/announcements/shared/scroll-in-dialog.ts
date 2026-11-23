import type { TouchEvent, WheelEvent } from "react";

/**
 * Props for a portaled popover / panel that scrolls while a Radix Dialog is
 * open.
 *
 * A modal Dialog locks page scroll with `react-remove-scroll`, which swallows
 * wheel and touch events that start outside the dialog's own DOM. A popover is
 * portaled to <body>, so it counts as "outside" and its list stops scrolling.
 * Stopping the event's propagation here keeps it away from that listener.
 * (Same fix as `components/break-logger/break-datetime-field.tsx`.)
 *
 * Spread onto the portaled content element:
 *
 *   <PopoverContent {...scrollInDialog} className="max-h-[min(24rem,60dvh)] overflow-y-auto" />
 */
export const scrollInDialog = {
  onWheel: (event: WheelEvent<HTMLElement>) => event.stopPropagation(),
  onTouchMove: (event: TouchEvent<HTMLElement>) => event.stopPropagation(),
} as const;
