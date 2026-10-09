/* ────────────────────────────────────────────────────────────────────────── */
/*  Geometry helpers for the inspector. Read-only: nothing here writes to    */
/*  the page except `scrollBy` on a scroller the user is already allowed to  */
/*  scroll (see `scrollerFor`).                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Below this an element is chrome (a separator, an icon), not a pickable part. */
export const MIN_TARGET_PX = 24;

export function toBox(r: DOMRect | Box): Box {
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function intersect(a: Box, b: Box): Box | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

export function sameBox(a: Box, b: Box, tolerance = 2): boolean {
  return (
    Math.abs(a.left - b.left) <= tolerance &&
    Math.abs(a.top - b.top) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

export function containsPoint(b: Box, x: number, y: number): boolean {
  return x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height;
}

export function viewportBox(): Box {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** Rendered, not transparent, not `visibility:hidden`, and big enough to pick. */
export function isVisibleEl(el: Element, minPx = MIN_TARGET_PX): boolean {
  const check = (el as Element & {
    checkVisibility?: (o?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
  }).checkVisibility;
  if (typeof check === "function") {
    if (!check.call(el, { checkOpacity: true, checkVisibilityCSS: true })) return false;
  } else if (el.getClientRects().length === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width >= minPx && r.height >= minPx;
}

/** Element children that are actually on screen (ignores 1px separators and hidden twins). */
export function visibleChildren(el: Element, minPx = 2): Element[] {
  return Array.from(el.children).filter((c) => isVisibleEl(c, minPx));
}

const CLIPS = new Set(["hidden", "clip", "auto", "scroll", "overlay"]);

/**
 * What the user can actually see of `el`: its box ∩ the viewport ∩ every
 * ancestor that clips its overflow (per axis). Null when fully clipped.
 */
export function visibleRect(el: Element): Box | null {
  let box: Box | null = intersect(toBox(el.getBoundingClientRect()), viewportBox());
  let node = el.parentElement;
  while (box && node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const clipX = CLIPS.has(cs.overflowX);
    const clipY = CLIPS.has(cs.overflowY);
    if (clipX || clipY) {
      const r = node.getBoundingClientRect();
      const clip: Box = {
        left: clipX ? r.left : -1e6,
        top: clipY ? r.top : -1e6,
        width: clipX ? r.width : 2e6,
        height: clipY ? r.height : 2e6,
      };
      box = intersect(box, clip);
    }
    node = node.parentElement;
  }
  return box;
}

function canScroll(el: Element, axis: "x" | "y", delta: number): boolean {
  const cs = getComputedStyle(el);
  const overflow = axis === "y" ? cs.overflowY : cs.overflowX;
  // Only real scrollers. `overflow:hidden` boxes can be scrolled from script,
  // but the user has no way to scroll them back — never touch those.
  if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") return false;
  if (axis === "y") {
    if (el.scrollHeight <= el.clientHeight) return false;
    return delta < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 0) return false;
  // RTL scrollers run from -max (far left) to 0 (start, on the right) in
  // every current engine; LTR from 0 to max. `scrollBy({ left })` moves the
  // same direction in both, so only the range changes.
  const rtl = cs.direction === "rtl";
  const lo = rtl ? -max : 0;
  const hi = rtl ? 0 : max;
  return delta < 0 ? el.scrollLeft > lo + 0.5 : el.scrollLeft < hi - 0.5;
}

/**
 * The scroller a wheel/drag over `from` should move: the first ancestor
 * (up to and including `limit`, normally `<main>`) that is a real scroller
 * and can still move that way. Never html/body or an `overflow:hidden` box.
 */
export function scrollerFor(
  from: Element | null,
  axis: "x" | "y",
  delta: number,
  limit: Element | null,
): Element | null {
  let node: Element | null = from;
  while (node && node !== document.body && node !== document.documentElement) {
    if (canScroll(node, axis, delta)) return node;
    if (node === limit) break;
    node = node.parentElement;
  }
  // Fall back to <main> only for points inside it — a wheel over the
  // sidebar must never scroll the page.
  const inside = !from || (limit?.contains(from) ?? false);
  return limit && inside && canScroll(limit, axis, delta) ? limit : null;
}

/**
 * Bring `el` into view inside its nearest REAL vertical scroller, by
 * scrolling that scroller only. Never `scrollIntoView`: it also scrolls
 * `overflow:hidden` ancestors (html, body, the shell), which the user then
 * has no way to scroll back.
 */
export function revealInScroller(el: Element, limit: Element | null): void {
  const r = el.getBoundingClientRect();
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const scrolls =
      (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflowY === "overlay") &&
      node.scrollHeight > node.clientHeight;
    if (scrolls) {
      const box = node.getBoundingClientRect();
      if (r.top < box.top + 8) node.scrollBy({ top: r.top - box.top - 24 });
      else if (r.bottom > box.bottom - 8) {
        node.scrollBy({ top: Math.min(r.bottom - box.bottom + 24, r.top - box.top - 24) });
      }
      return;
    }
    if (node === limit) return;
    node = node.parentElement;
  }
}

/** Normalise a wheel delta to pixels. */
export function wheelPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * 16; // lines
  if (mode === 2) return delta * window.innerHeight; // pages
  return delta;
}
