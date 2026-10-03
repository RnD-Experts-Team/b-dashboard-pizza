"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OddCalendar } from "./odd-calendar";
import { OddDayChart } from "./odd-day-chart";
import type { Basis, OddDay, WeekPlan } from "@/lib/scheduling/day-plan";
import type { OddView } from "@/lib/scheduling/week-outlook.store";

/**
 * One fixed-height window holding the three ways to look at the odd days: the
 * text list, a calendar, and the chart for one date. They fade and slide into
 * each other rather than swapping, so the eye follows the change. A click on a
 * coloured day opens its chart; the arrow (or Escape) brings the calendar back.
 *
 * All three stay mounted but the hidden ones are `inert`, so they cannot be
 * tabbed into or read out, and a pane that is leaving still has its content to
 * animate with. The window never changes height, so neither does the card.
 */

// `translate`, not `transform`: Tailwind v4's translate utilities set the
// standalone `translate` property, which a `transition-[... ,transform]` never sees.
const PANE =
  "absolute inset-0 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none";
const GONE = "pointer-events-none opacity-0";

export function OddDaysWindow({
  plan,
  odd,
  basis,
  view,
  list,
}: {
  plan: WeekPlan;
  odd: OddDay[];
  basis: Basis;
  view: OddView;
  /** The text list, drawn by the caller. */
  list: ReactNode;
}) {
  const charts = view === "charts";
  const [selected, setSelected] = useState<string | null>(null);
  // The last date opened, kept after going back so its pane has content to fade out with.
  const [shown, setShown] = useState<string | null>(null);

  const selectedOdd = selected ? (odd.find((o) => o.date === selected) ?? null) : null;
  // The charts always open on the calendar, and a date that stopped being odd
  // (another week, store or basis) has nothing left to draw.
  if (selected !== null && (!charts || !selectedOdd)) setSelected(null);

  const shownOdd = shown ? (odd.find((o) => o.date === shown) ?? null) : null;
  const showDay = charts && selectedOdd !== null;

  const open = (date: string) => {
    setShown(date);
    setSelected(date);
  };
  const back = () => setSelected(null);

  // Keep the keyboard where the eye is: onto the arrow when a day opens, and
  // back onto that day's cell when the calendar returns.
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const backRef = useRef<HTMLButtonElement>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = selected;
    if (selected && !was) backRef.current?.focus({ preventScroll: true });
    else if (!selected && was) cellRefs.current.get(was)?.focus({ preventScroll: true });
  }, [selected]);

  const listHidden = charts;
  const calendarHidden = !charts || showDay;
  const dayHidden = !showDay;

  return (
    // The window is as tall as what is showing needs at this width, and no
    // taller. Wide, the calendar sits beside its legend and the day's two hour
    // charts sit side by side, so 10rem does for both. Narrower, the calendar
    // stacks and the day chart fits the same 11.75rem or 13rem. The outer
    // box is the container, because a box cannot size itself from its own width,
    // only its children can.
    <div className="@container">
      <div
        className="relative h-52 overflow-hidden @md:h-47 @[32.5rem]:h-40"
      >
      {/* The sentences. Focusable so the keyboard can scroll them. */}
      <div
        role="region"
        aria-label="Odd days"
        tabIndex={0}
        inert={listHidden}
        aria-hidden={listHidden}
        className={cn(
          PANE,
          "overflow-y-auto rounded-sm pe-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          listHidden && GONE,
        )}
      >
        {list}
      </div>

      <div
        inert={calendarHidden}
        aria-hidden={calendarHidden}
        className={cn(PANE, calendarHidden && GONE, showDay && "-translate-x-4 rtl:translate-x-4")}
      >
        <OddCalendar
          plan={plan}
          odd={odd}
          basis={basis}
          selected={selected}
          onOpen={open}
          cellRef={(date, el) => {
            if (el) cellRefs.current.set(date, el);
            else cellRefs.current.delete(date);
          }}
        />
      </div>

      <div
        inert={dayHidden}
        aria-hidden={dayHidden}
        onKeyDown={(e) => {
          if (e.key === "Escape" && showDay) {
            e.stopPropagation();
            back();
          }
        }}
        className={cn(PANE, dayHidden && GONE, dayHidden && "translate-x-4 rtl:-translate-x-4")}
      >
        {/* Keyed by date, so each date starts with a fresh legend lens. */}
        {shownOdd && (
          <OddDayChart key={shownOdd.date} plan={plan} odd={shownOdd} active={showDay} onBack={back} backRef={backRef} />
        )}
      </div>
      </div>
    </div>
  );
}


