/**
 * Scrolling helpers that work inside this app's shell.
 *
 * `window.scrollTo` does nothing on a dashboard page. `AppShell` scrolls an
 * inner `<main className="flex-1 overflow-auto">`, and its `inset` and
 * `floating` variants nest two scrollable elements — so anything that wants to
 * move the page has to find the element that actually scrolls rather than
 * assume it is the document.
 */

/** True when this element is the one that scrolls, not just a tall box. */
function isScrollable(node: Element): boolean {
  const overflowY = getComputedStyle(node).overflowY;
  return (
    (overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay") &&
    node.scrollHeight > node.clientHeight
  );
}

/**
 * Scroll every scrollable ancestor of `el` back to its top, plus the window.
 *
 * Every ancestor rather than the first: the layout variants differ in which
 * level scrolls, and scrolling one that is already at zero costs nothing.
 */
export function scrollAncestorsToTop(el: Element | null) {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  let node = el?.parentElement ?? null;
  while (node) {
    if (isScrollable(node)) node.scrollTo({ top: 0, behavior: "smooth" });
    node = node.parentElement;
  }
}

/**
 * Bring `el` into view, wherever the thing that scrolls happens to be.
 *
 * `scrollIntoView` already walks the ancestor chain itself, so this is mostly
 * a guard plus a house default. `block: "nearest"` is deliberate: an alert that
 * is already on screen should not jerk the page to recentre it.
 */
export function scrollIntoViewSafely(el: Element | null) {
  if (typeof window === "undefined" || !el) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
