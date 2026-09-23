/**
 * Capturing an element that is bigger than everything around it.
 *
 * `html2canvas` renders from the laid-out document, so anything that clips the
 * target clips the image. The schedule grid is a wide table inside an
 * `overflow-x-auto` wrapper, and that wrapper is itself inside the app shell —
 * a `max-w-7xl` container, a scrolling `<main>`, two `overflow-hidden` wrappers
 * and a `<body>` that is also `overflow: hidden`. Six separate things between
 * the table and a full-width picture of it.
 *
 * So this works in both directions: it grows the scrollers INSIDE the target,
 * and it unclips every ancestor ABOVE it. Getting only one of those is the
 * trap — expanding the inside alone still leaves the shell cropping the result,
 * which is exactly what a naive fix looks like when it is tested on a bare page
 * rather than inside the real shell.
 */

/** Overflow values that clip. `visible` and `clip` are not scroll containers. */
const CLIPPING = new Set(["auto", "scroll", "hidden", "overlay"]);

/**
 * Chrome refuses canvases beyond roughly this per side, and the failure is a
 * BLANK image rather than an exception — so it has to be prevented, not caught.
 * Kept well under the real limit, which varies by browser and free memory.
 */
const MAX_CANVAS_PX = 12_000;

interface CaptureOptions {
  /** Device-pixel multiplier. Reduced automatically if the result would be too big. */
  scale?: number;
  backgroundColor?: string | null;
}

/** One element's inline styles, so they can be put back exactly as they were. */
interface Restore {
  el: HTMLElement;
  overflow: string;
  width: string;
  minWidth: string;
  maxWidth: string;
  height: string;
  maxHeight: string;
  position: string;
  display: string;
}

function snapshot(el: HTMLElement): Restore {
  return {
    el,
    // The INLINE values, not the computed ones — restoring a computed value
    // would freeze a class-driven style as an inline override forever.
    overflow: el.style.overflow,
    width: el.style.width,
    minWidth: el.style.minWidth,
    maxWidth: el.style.maxWidth,
    height: el.style.height,
    maxHeight: el.style.maxHeight,
    position: el.style.position,
    display: el.style.display,
  };
}

function restoreAll(entries: Restore[]) {
  for (const e of entries) {
    e.el.style.overflow = e.overflow;
    e.el.style.width = e.width;
    e.el.style.minWidth = e.minWidth;
    e.el.style.maxWidth = e.maxWidth;
    e.el.style.height = e.height;
    e.el.style.maxHeight = e.maxHeight;
    e.el.style.position = e.position;
    e.el.style.display = e.display;
  }
}

/**
 * Capture `target` in full, including whatever scrollbars and ancestors hide.
 *
 * Everything it changes is reversed in a `finally`, so a capture that throws
 * cannot leave the page stretched open.
 */
export async function captureFullElement(
  target: HTMLElement,
  { scale = 2, backgroundColor = null }: CaptureOptions = {},
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const touched: Restore[] = [];

  const change = (el: HTMLElement, apply: (s: CSSStyleDeclaration) => void) => {
    touched.push(snapshot(el));
    apply(el.style);
  };

  try {
    /* ── 1. Inside: grow anything that clips its own content ──────────── */

    /**
     * Deepest first.
     *
     * `querySelectorAll` returns document order, which puts a parent before its
     * children — exactly backwards here. The grid's outer card is
     * `overflow-hidden` but does not overflow until its scrolling child has
     * been widened, so judging the parent first skips it, and it then clips the
     * child right back to the visible width.
     */
    const inside = [target, ...Array.from(target.querySelectorAll("*"))]
      .filter((n): n is HTMLElement => n instanceof HTMLElement)
      .reverse();

    for (const el of inside) {
      const cs = getComputedStyle(el);

      const overflowsX =
        CLIPPING.has(cs.overflowX) && el.scrollWidth > el.clientWidth;
      const overflowsY =
        CLIPPING.has(cs.overflowY) && el.scrollHeight > el.clientHeight;

      if (overflowsX || overflowsY) {
        // Pin the size BEFORE unclipping: reading `scrollWidth` afterwards
        // would measure a box that has already reflowed.
        const w = el.scrollWidth;
        const h = el.scrollHeight;
        change(el, (st) => {
          if (overflowsX) st.width = `${w}px`;
          if (overflowsY) st.height = `${h}px`;
          st.overflow = "visible";
        });
        continue;
      }

      /**
       * A sticky cell is painted at its scrolled offset. Once the container
       * above is unclipped there is nothing left to stick to, and the grid's
       * pinned employee column would land on top of Monday. Only genuine
       * `sticky` — `relative` is load-bearing, because the shift cards hang
       * their accent rails and hover overlays off it.
       */
      if (cs.position === "sticky") {
        change(el, (st) => {
          st.position = "static";
        });
      }

      /** Chrome that should not be in the picture. */
      if (
        el.hasAttribute("data-screenshot-ignore") ||
        el.hasAttribute("data-screenshot-btn")
      ) {
        change(el, (st) => {
          st.display = "none";
        });
      }
    }

    /* ── 2. Measure, then pin, so step 3 cannot feed back ─────────────── */

    const fullWidth = target.scrollWidth;
    const fullHeight = target.scrollHeight;

    /**
     * Fixing the target's own width matters more than it looks.
     *
     * Widening the ancestors below would otherwise widen the target too — it is
     * a block element inside them, and the table is `w-full`. The measurement
     * and the thing being measured would chase each other, and the capture
     * would come out padded with empty columns.
     */
    change(target, (st) => {
      st.width = `${fullWidth}px`;
      st.maxWidth = "none";
    });

    /* ── 3. Above: stop the shell cropping the result ─────────────────── */

    /**
     * Every ancestor up to `<html>`, `<body>` included.
     *
     * `min-width` rather than `width`, and no attempt to be precise about it:
     * the canvas is sized from the explicit `width`/`height` passed below, so
     * an over-wide ancestor costs nothing, while an under-wide one silently
     * crops the picture.
     */
    let node: HTMLElement | null = target.parentElement;
    while (node) {
      const cs = getComputedStyle(node);
      const clips =
        CLIPPING.has(cs.overflowX) ||
        CLIPPING.has(cs.overflowY) ||
        cs.maxWidth !== "none" ||
        cs.maxHeight !== "none";

      if (clips) {
        change(node, (st) => {
          st.overflow = "visible";
          st.maxWidth = "none";
          st.maxHeight = "none";
          st.minWidth = `${fullWidth}px`;
        });
      }
      node = node.parentElement;
    }

    // Let the reflow land before capturing. `requestAnimationFrame` is not
    // usable here — it does not fire in a background tab, so a capture started
    // from one would hang rather than finish.
    await new Promise((r) => setTimeout(r, 60));

    /* ── 4. Capture ───────────────────────────────────────────────────── */

    /**
     * Keep the canvas inside what the browser will actually allocate. Past the
     * limit it hands back a blank image instead of throwing, so a slightly
     * softer screenshot is the better failure.
     */
    const safeScale = Math.max(
      1,
      Math.min(scale, MAX_CANVAS_PX / Math.max(fullWidth, fullHeight, 1)),
    );

    return await html2canvas(target, {
      backgroundColor,
      scale: safeScale,
      useCORS: true,
      logging: false,
      // Stated explicitly: the window itself is still its original size, and
      // without these html2canvas crops back to the viewport it can see.
      width: fullWidth,
      height: fullHeight,
      windowWidth: Math.max(fullWidth, document.documentElement.clientWidth),
      windowHeight: Math.max(fullHeight, document.documentElement.clientHeight),
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    restoreAll(touched);
  }
}
