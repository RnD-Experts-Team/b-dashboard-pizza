"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The calendar's wall clock (ms), ticked once a minute by the page. Views read
 * it for the now-line, live events and "past" fading instead of calling
 * `Date.now()` during render, so a render is a pure function of its inputs.
 */
const ClockContext = createContext<number>(0);

export function CalendarClockProvider({ now, children }: { now: number; children: ReactNode }) {
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function useCalendarClock(): number {
  return useContext(ClockContext);
}
