"use client";

import { useEffect, useState, type RefObject } from "react";
import { useScrollDirection } from "@/lib/hooks/use-scroll-direction";
import { useFabPositionStore } from "@/lib/store/fab-position.store";

/** components/layout/bottom-nav.tsx renders the mobile bar with this id. */
const BOTTOM_NAV_ID = "bottom-nav-bar";

interface Measured {
  /** The scroll container's own bottom padding: a sticky box keeps that far from its edge. */
  stickyPad: number;
  /** All bottom padding between the box and the scroll container's end. */
  trail: number;
  /** The mobile bottom nav's height, 0 when it is not shown at this width. */
  nav: number;
}

const NONE: Measured = { stickyPad: 0, trail: 0, nav: 0 };

function px(el: Element, prop: string): number {
  return Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
}

/** The element's ancestors below `stop` (not including it), nearest first. */
function ancestorsUpTo(el: Element, stop: Element): Element[] {
  const parent = el.parentElement;
  return !parent || parent === stop ? [] : [parent, ...ancestorsUpTo(parent, stop)];
}

/**
 * Where a sticky action bar has to sit to be flush with the bottom of the
 * content area, in every AppShell layout variant, without editing the shell.
 *
 * The shell pads its scroll container differently per variant (classic,
 * floating and top-nav pad `<main>` itself; inset pads a div inside it), and
 * a sticky box stops short of the scroll container's padding — that was the
 * gap under the old footer. So this measures the real paddings and returns:
 * - `bottom`: a negative offset that cancels `<main>`'s padding, so the bar
 *   touches the bottom edge while scrolling; lifted above the mobile bottom
 *   nav while that nav is showing (it hides on scroll down, shows on scroll up
 *   — same hook, same rule);
 * - `marginBottom`: a negative margin that pulls the bar through the trailing
 *   padding, so at the end of the page there is no empty strip below it.
 *
 * `mounted` says whether the bar is rendered, so it is measured when it appears.
 */
export function useDockInsets(ref: RefObject<HTMLElement | null>, mounted = true): { bottom: number; marginBottom: number } {
  const [m, setM] = useState<Measured>(NONE);
  const direction = useScrollDirection();

  useEffect(() => {
    const el = ref.current;
    const main = el?.closest("main");
    if (!el || !main) return;

    const measure = () => {
      const stickyPad = px(main, "padding-bottom");
      const trail = ancestorsUpTo(el, main).reduce((sum, node) => sum + px(node, "padding-bottom") + px(node, "border-bottom-width"), stickyPad);
      const bar = document.getElementById(BOTTOM_NAV_ID);
      const nav = bar && getComputedStyle(bar).display !== "none" ? bar.offsetHeight : 0;
      setM((prev) => (prev.stickyPad === stickyPad && prev.trail === trail && prev.nav === nav ? prev : { stickyPad, trail, nav }));
    };

    // A ResizeObserver reports once as soon as it starts observing, so this
    // also takes the first measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    const bar = document.getElementById(BOTTOM_NAV_ID);
    if (bar) observer.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, mounted]);

  const navShown = m.nav > 0 && direction === "up";
  return { bottom: (navShown ? m.nav : 0) - m.stickyPad, marginBottom: -m.trail };
}

/**
 * How much room `ref` has to leave at its end for the draggable Debrief
 * button (components/layout/floating-debrief-button.tsx), so the button never
 * sits on top of the action. 0 when the button is not shown, or has been
 * dragged somewhere it does not cover `ref`. `within` is the full-width bar
 * the button's side is judged against (default `ref`): a row inside the bar is
 * only padded when the button is on that row.
 */
export function useFabClearance(ref: RefObject<HTMLElement | null>, mounted = true, within?: RefObject<HTMLElement | null>): number {
  const fabPos = useFabPositionStore((s) => s.debriefPos);
  const [clear, setClear] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const fab = fabPos
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-report-target='floating']")).find(
            (node) => getComputedStyle(node).position === "fixed" && Math.round(node.getBoundingClientRect().left) === Math.round(fabPos.x),
          )
        : undefined;
      if (!fab) return setClear(0);
      const rowBox = el.getBoundingClientRect();
      const bar = (within?.current ?? el).getBoundingClientRect();
      const box = fab.getBoundingClientRect();
      // A few pixels of the button's rim over the row's edge is not worth moving the row for.
      const overlapsY = Math.min(box.bottom, rowBox.bottom) - Math.max(box.top, rowBox.top) > 10;
      const rtl = getComputedStyle(el).direction === "rtl";
      // Only a button resting on the bar's end side pushes the buttons over.
      const room = rtl ? box.right - bar.left : bar.right - box.left;
      setClear(overlapsY && room > 0 && room < bar.width / 2 ? Math.ceil(room) + 8 : 0);
    };
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    // The bar slides (the bottom nav hides, a dialog's scroll lock lifts) and the
    // button changes shape without any event this hook can hear, so look again
    // now and then. A repeat of the same answer costs no render.
    const poll = window.setInterval(measure, 300);
    const observer = new ResizeObserver(later);
    observer.observe(el);
    if (within?.current) observer.observe(within.current);
    window.addEventListener("resize", later);
    // The bar only moves while the page is shorter than the screen, but a
    // scroll is the cheap moment to notice it.
    window.addEventListener("scroll", later, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(poll);
      observer.disconnect();
      window.removeEventListener("resize", later);
      window.removeEventListener("scroll", later, true);
    };
  }, [ref, within, mounted, fabPos]);

  return clear;
}
