/**
 * Bring a section of the page into view the gentle way: a smooth scroll (an
 * instant one when the person asked their system for less motion), stopping
 * clear of the top bar (the section's own `scroll-mt-*`), then a brief ring
 * around it so the eye lands on it. The URL is left alone -- jumping inside a
 * report is not a new page, and Back should not walk through the tables.
 *
 * NOT `scrollIntoView`. That scrolls EVERY scrollable ancestor, and the app
 * shell is a fixed-height frame with its own inner scroller: when the section
 * is near the bottom (the inner scroller already at its end), the browser
 * scrolled the document itself instead, sliding the whole shell up off the
 * screen and leaving a dark band below. So only the nearest scroller moves,
 * and never past its own end.
 */
export function scrollToSection(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const scroller = scrollParent(el);

  if (scroller) {
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTo({ top: clamp(scroller.scrollTop + offset - margin, 0, max), behavior });
  } else {
    const root = document.scrollingElement ?? document.documentElement;
    const max = root.scrollHeight - window.innerHeight;
    window.scrollTo({ top: clamp(window.scrollY + el.getBoundingClientRect().top - margin, 0, max), behavior });
  }

  el.classList.add("ring-2", "ring-primary/50", "ring-offset-2", "ring-offset-background");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary/50", "ring-offset-2", "ring-offset-background");
  }, 1600);

  // Focus for keyboard and screen-reader users, without a second scroll.
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

/** The nearest ancestor that actually scrolls; null means the document does. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
