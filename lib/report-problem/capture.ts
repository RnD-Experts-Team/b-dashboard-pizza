import { ATTR, OUT_OF_FLOW_SELECTOR } from "./attributes";
import { visibleRect } from "./geometry";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Screenshot of the picked part — exactly what the user saw of it.         */
/*                                                                            */
/*  NEVER mutates the live page. (lib/screenshot.ts rewrites ancestor styles */
/*  to capture whole grids; on the Screens page that would trip the tile     */
/*  ResizeObserver and relayout live video. Not used here.) The only touch   */
/*  is a no-op `data-rp-scroll` attribute recording scroll offsets for the   */
/*  clone, removed in the same tick.                                         */
/*                                                                            */
/*  html2canvas clones the document SYNCHRONOUSLY inside the call, so the    */
/*  page state is fixed the moment `captureElement` is called; everything    */
/*  after that works on the clone.                                           */
/* ────────────────────────────────────────────────────────────────────────── */

type Html2Canvas = typeof import("html2canvas-pro").default;

let loader: Promise<Html2Canvas> | null = null;

/** Start loading the library as soon as inspect mode starts. */
export function preloadCapture(): Promise<Html2Canvas> {
  if (!loader) {
    loader = import("html2canvas-pro").then((m) => m.default);
    loader.catch(() => {
      loader = null;
    });
  }
  return loader;
}

export interface CaptureResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  /** Cropped to the visible part — the element extends past what was on screen. */
  partial: boolean;
}

export type CaptureFailure = "timeout" | "tainted" | "empty" | "failed";

export class CaptureError extends Error {
  constructor(
    readonly reason: CaptureFailure,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "CaptureError";
  }
}

const MAX_SIDE = 2400;
const MAX_BYTES = 9.5 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const KILL_MOTION = "*,*::before,*::after{animation:none!important;transition:none!important}";

/**
 * WebKit (Safari, and every browser on iPad/iPhone) taints a canvas that
 * draws an SVG containing `foreignObject` — ApexCharts puts its legends
 * there — so those are pruned up front on WebKit.
 */
export function isWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/(Chrome|Chromium|Edg|OPR)\//.test(ua);
  return iOS || safari;
}

function isTransparent(color: string): boolean {
  return (
    !color ||
    color === "transparent" ||
    /rgba\([^)]*,\s*0\)$/.test(color) ||
    /\/\s*0\)$/.test(color) // oklch(… / 0), color(srgb … / 0)
  );
}

/** The first solid background behind the element — the screenshot's backdrop. */
function backgroundFor(el: Element): string | null {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (!isTransparent(bg)) return bg;
  }
  return null;
}

/** Record scroll offsets so the clone can be put back exactly as seen. */
function tagScrolled(el: Element): Element[] {
  const tagged: Element[] = [];
  const mark = (n: Element) => {
    if (n.scrollTop || n.scrollLeft) {
      n.setAttribute(ATTR.scroll, `${n.scrollTop},${n.scrollLeft}`);
      tagged.push(n);
    }
  };
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) mark(p);
  mark(el);
  const inner = el.getElementsByTagName("*");
  for (let i = 0; i < inner.length && i < 8000; i++) mark(inner[i]);
  return tagged;
}

/**
 * Which live nodes the clone may skip. Only things that CAN'T move the
 * layout are dropped — in-flow siblings stay, because they drive flex/grid
 * widths and container queries, and dropping them would reflow the target.
 */
function makeIgnore(target: Element, pruneForeignObject: boolean) {
  const hidden = new WeakMap<Element, boolean>();
  const isHidden = (el: Element) => {
    let v = hidden.get(el);
    if (v === undefined) {
      v = getComputedStyle(el).display === "none";
      hidden.set(el, v);
    }
    return v;
  };
  const head = document.head;

  return (n: Element): boolean => {
    if (n.hasAttribute?.(ATTR.ui)) return true;
    const tag = n.localName.toLowerCase();
    if (tag === "audio" || tag === "noscript") return true;
    if (n === target || n.contains(target)) return false;
    if (target.contains(n)) return pruneForeignObject && tag === "foreignobject";

    // Unrelated to the target.
    // Stylesheets and @font-face rules can sit anywhere — React 19 and
    // next/font may place them under <body> — and every one is needed.
    if (tag === "style" || tag === "link") return false;
    if (head.contains(n)) return false;
    if (n.parentElement === document.body) return true; // portals, toaster, announcer
    if (n.matches(OUT_OF_FLOW_SELECTOR)) return true; // PiP, debrief button, bottom bar
    const parent = n.parentElement;
    if (parent instanceof SVGElement) return true; // keep each <svg> box, drop its drawing
    if (parent && isHidden(parent)) return true; // keep a display:none node, drop its insides
    return false;
  };
}

function onClone(doc: Document, clonedTarget: HTMLElement) {
  // Animations restart in the clone and would be captured at their first
  // frame (`animate-in` at opacity 0, collapsibles half open).
  const style = doc.createElement("style");
  style.textContent = KILL_MOTION;
  doc.head.appendChild(style);
  // The target's own transform (the PiP is placed by one) would offset the
  // paint from the measured box.
  for (const prop of ["transform", "translate", "scale", "rotate"]) {
    clonedTarget.style?.setProperty(prop, "none");
  }
  // Re-apply scroll offsets after the motion kill may have changed sizes.
  doc.querySelectorAll(`[${ATTR.scroll}]`).forEach((n) => {
    const [top, left] = (n.getAttribute(ATTR.scroll) ?? "0,0").split(",").map(Number);
    n.scrollTop = top || 0;
    n.scrollLeft = left || 0;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch (err) {
      reject(err); // SecurityError on a tainted canvas
    }
  });
}

function extFor(type: string): string {
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg") return "jpg";
  return "png";
}

async function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  let blob = (await canvasToBlob(canvas, "image/webp", 0.92)) ?? (await canvasToBlob(canvas, "image/png"));
  if (!blob) throw new CaptureError("failed", "Encoding failed.");
  if (blob.size > MAX_BYTES) {
    const small = document.createElement("canvas");
    small.width = Math.round(canvas.width * 0.75);
    small.height = Math.round(canvas.height * 0.75);
    small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
    blob = (await canvasToBlob(small, "image/webp", 0.85)) ?? blob;
    small.width = small.height = 0;
  }
  return blob;
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      onTimeout?.();
      reject(new CaptureError("timeout"));
    }, ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function isSecurityError(err: unknown): boolean {
  return err instanceof DOMException ? err.name === "SecurityError" : /tainted|security/i.test(String(err));
}

/**
 * Starts the capture. The clone is taken synchronously inside this call
 * when `h2c` is already loaded (see `preloadCapture`).
 */
export function captureElement(
  el: HTMLElement,
  h2c: Html2Canvas,
  opts: { kind: string; pruneForeignObject?: boolean } = { kind: "part" },
): Promise<CaptureResult> {
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return Promise.reject(new CaptureError("empty"));

  const vis = visibleRect(el);
  const partial = Boolean(
    vis && (vis.width < rect.width - 1 || vis.height < rect.height - 1),
  );
  const w = partial && vis ? vis.width : rect.width;
  const h = partial && vis ? vis.height : rect.height;
  const base = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.max(0.5, Math.min(base, MAX_SIDE / Math.max(w, h)));
  const pruneForeignObject = opts.pruneForeignObject ?? isWebKit();

  const tagged = tagScrolled(el);
  let pending: Promise<HTMLCanvasElement>;
  try {
    pending = h2c(el, {
      backgroundColor: backgroundFor(el),
      scale,
      useCORS: true,
      // A cross-origin image renders blank instead of making the export throw.
      allowTaint: false,
      logging: false,
      imageTimeout: 4000,
      ignoreElements: makeIgnore(el, pruneForeignObject),
      onclone: onClone,
      // html2canvas treats x/y as offsets from the element's own box.
      ...(partial && vis
        ? { x: vis.left - rect.left, y: vis.top - rect.top, width: vis.width, height: vis.height }
        : {}),
    });
  } finally {
    // The clone already carries the markers; the live page must not.
    tagged.forEach((n) => n.removeAttribute(ATTR.scroll));
  }

  const abandon = () => {
    // html2canvas keeps working after we stop waiting: drop the hidden clone
    // of the page it attached to <body>, and free the canvas if one arrives.
    document.querySelectorAll("iframe.html2canvas-container").forEach((f) => f.remove());
    pending.then(
      (late) => {
        late.width = 0;
        late.height = 0;
      },
      () => undefined,
    );
  };

  return withTimeout(pending, TIMEOUT_MS, abandon)
    .then(async (canvas) => {
      try {
        const blob = await encode(canvas);
        const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
        const file = new File([blob], `report-${opts.kind}-${stamp}.${extFor(blob.type)}`, {
          type: blob.type || "image/png",
        });
        return {
          file,
          previewUrl: URL.createObjectURL(file),
          width: canvas.width,
          height: canvas.height,
          partial,
        };
      } finally {
        // iOS caps total canvas memory; free it before any retake.
        canvas.width = 0;
        canvas.height = 0;
      }
    })
    .catch((err) => {
      if (err instanceof CaptureError) throw err;
      // A chart legend (SVG foreignObject) tainted the canvas — retry once without them.
      if (isSecurityError(err) && !pruneForeignObject) {
        return captureElement(el, h2c, { ...opts, pruneForeignObject: true });
      }
      throw new CaptureError(isSecurityError(err) ? "tainted" : "failed", String(err));
    });
}
