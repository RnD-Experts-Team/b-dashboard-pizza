"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ATTR, isReportUi } from "@/lib/report-problem/attributes";
import { buildIndex, pickAt, type Candidate, type CandidateIndex } from "@/lib/report-problem/candidates";
import {
  intersect,
  revealInScroller,
  scrollerFor,
  toBox,
  viewportBox,
  visibleRect,
  wheelPixels,
  type Box,
} from "@/lib/report-problem/geometry";
import { MIN_WIDTH } from "@/lib/report-problem/guard";
import type { PickMode } from "@/lib/report-problem/pages";
import { useCandidateName } from "./use-candidate-name";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Inspect mode. One full-screen CATCHER sits above everything (z 10040 >   */
/*  the Screen PiP's 9999) and receives every pointer event, so no app       */
/*  handler ever runs while the user is choosing: no Talk-to-All pointerdown,*/
/*  no drags, no card-expand clicks, no link navigation. Nothing on the page */
/*  is mutated — outlines and the highlight are drawn in our own layer from  */
/*  getBoundingClientRect.                                                   */
/*                                                                            */
/*  We never stopPropagation POINTER events globally (React listens on       */
/*  `document`; that would break every handler in the app). Keyboard is the  */
/*  one exception: while choosing, a window capture listener swallows        */
/*  unmodified keys so page shortcuts (Screens M/C/F) can't fire.            */
/* ────────────────────────────────────────────────────────────────────────── */

interface InspectOverlayProps {
  mode: PickMode;
  /** Frozen on the chosen part while the screenshot is taken. */
  capturing: boolean;
  onChoose: (candidate: Candidate) => void;
  onCancel: () => void;
  /** `?reportDebug=1` — label every candidate with its kind and id. */
  debug?: boolean;
}

const MOVE_THROTTLE_MS = 16;
/**
 * How long the pointer has to rest on a new part before the highlight moves
 * there — sweeping across the page doesn't make it flicker from card to card.
 * A click never waits for it: it always picks what's under the pointer.
 */
const HOVER_DELAY_MS = 140;
const DRAG_PX = 8;
/** The Enter that pressed the trigger auto-repeats — ignore Enter briefly. */
const ENTER_GRACE_MS = 300;
const REBUILD_DEBOUNCE_MS = 150;
const REDRAW_INTERVAL_MS = 600;

/** How long the border takes to draw itself around a part; it lights up after. */
const DRAW_MS = 600;
const SCRIM = "rgba(0,0,0,0.55)";

/*
 * The hover animation: the border draws itself from the bottom-left corner
 * up the left side and on around (stroke-dashoffset 1 → 0 over a
 * pathLength=1 path), THEN the part's own dim fades out — it "lights up" —
 * and its name chip appears. Kept local to the overlay rather than in the
 * Core globals.css.
 */
const HIGHLIGHT_CSS = `
@keyframes rp-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes rp-fade-out { to { opacity: 0; } }
@keyframes rp-fade-in { to { opacity: 1; } }
.rp-border-path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rp-draw ${DRAW_MS}ms ease-in-out forwards; }
.rp-light-up { animation: rp-fade-out 250ms ease-out ${DRAW_MS}ms forwards; }
.rp-after-draw { opacity: 0; animation: rp-fade-in 200ms ease-out ${DRAW_MS}ms forwards; }
@media (prefers-reduced-motion: reduce) {
  .rp-border-path { animation: none; stroke-dashoffset: 0; }
  .rp-light-up { animation: none; opacity: 0; }
  .rp-after-draw { animation: none; opacity: 1; }
}
`;

/** A rounded rectangle that STARTS at the bottom-left corner and runs clockwise (up the left side first). */
function borderPath(w: number, h: number): string {
  const i = 1; // half the 2px stroke, so it isn't clipped by the svg edge
  const x0 = i;
  const y0 = i;
  const x1 = Math.max(w - i, x0);
  const y1 = Math.max(h - i, y0);
  const r = Math.max(0, Math.min(6, (x1 - x0) / 2, (y1 - y0) / 2));
  return [
    `M${x0},${y1 - r}`,
    `L${x0},${y0 + r}`,
    `A${r},${r} 0 0 1 ${x0 + r},${y0}`,
    `L${x1 - r},${y0}`,
    `A${r},${r} 0 0 1 ${x1},${y0 + r}`,
    `L${x1},${y1 - r}`,
    `A${r},${r} 0 0 1 ${x1 - r},${y1}`,
    `L${x0 + r},${y1}`,
    `A${r},${r} 0 0 1 ${x0},${y1 - r}`,
    "Z",
  ].join(" ");
}

interface PointerState {
  id: number;
  type: string;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  dragged: boolean;
}

export function InspectOverlay({ mode, capturing, onChoose, onCancel, debug }: InspectOverlayProps) {
  const t = useTranslations("reportProblem.inspect");
  const nameOf = useCandidateName();

  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<Candidate | null>(null);
  const [touchPreview, setTouchPreview] = useState(false);
  const [, setFrame] = useState(0);

  const indexRef = useRef<CandidateIndex | null>(null);
  const hoveredRef = useRef<Candidate | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerState | null>(null);
  const lastMoveRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  const capturingRef = useRef(capturing);
  const onChooseRef = useRef(onChoose);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    capturingRef.current = capturing;
    onChooseRef.current = onChoose;
    onCancelRef.current = onCancel;
  });

  const hoverSeqRef = useRef(0);
  const setHover = useCallback((c: Candidate | null) => {
    if (c?.el !== hoveredRef.current?.el) hoverSeqRef.current++;
    hoveredRef.current = c;
    setHovered(c);
  }, []);

  // The part the pointer is resting on, waiting out HOVER_DELAY_MS.
  const pendingRef = useRef<{ el: Element | null; timer: number } | null>(null);
  const clearPending = useCallback(() => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
    pendingRef.current = null;
  }, []);
  useEffect(() => clearPending, [clearPending]);

  /* ── Drawing: the page stays a plain dark scrim; only `?reportDebug=1`   */
  /*    paints candidate boxes + labels on the canvas. The highlight is DOM. */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const index = indexRef.current;
    if (!canvas || !index || !debug) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Read every rect first, then paint — no layout thrash. Page parts are
    // clipped to <main>'s visible box so a card scrolled under the top bar
    // never draws on top of it; regions clip to the viewport.
    const viewport = viewportBox();
    const main = index.main;
    const mainBox = main ? intersect(toBox(main.getBoundingClientRect()), viewport) : null;
    const hoveredEl = hoveredRef.current?.el;
    const boxes: { c: Candidate; r: Box }[] = [];
    for (const c of index.list) {
      if (c.el === hoveredEl || !c.el.isConnected) continue;
      const clip = main?.contains(c.el) ? mainBox : viewport;
      const r = clip ? intersect(toBox(c.el.getBoundingClientRect()), clip) : null;
      if (r) boxes.push({ c, r });
    }
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px ui-monospace, monospace";
    for (const { c, r } of boxes) {
      ctx.strokeRect(r.left + 1, r.top + 1, r.width - 2, r.height - 2);
      const text = `${c.kind}${c.id ? `#${c.id}` : ""}${c.outlined ? "" : " (coarse)"}`;
      const tw = ctx.measureText(text).width + 6;
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(r.left + 2, r.top + 2, tw, 14);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, r.left + 5, r.top + 12);
    }
  }, [debug]);

  const redraw = useCallback(() => {
    draw();
    setFrame((f) => f + 1);
  }, [draw]);

  const rebuild = useCallback(() => {
    indexRef.current = buildIndex(mode);
    // Candidates are rebuilt as new objects; keep pointing at the same
    // ELEMENT, or a second tap / Tab would no longer match the hover.
    const current = hoveredRef.current;
    if (current) setHover(indexRef.current.map.get(current.el) ?? null);
    redraw();
  }, [mode, redraw, setHover]);

  /* ── Lifecycle ───────────────────────────────────────────────────────── */

  useEffect(() => {
    setMounted(true);
    startedAtRef.current = Date.now();
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    rebuild();
    // Take focus off the page (closes an iPad keyboard, stops a focused
    // control from reacting) and park it on our bar.
    (document.activeElement as HTMLElement | null)?.blur?.();
    barRef.current?.focus({ preventScroll: true });
  }, [mounted, rebuild]);

  useEffect(() => {
    if (!mounted) return;
    const main = document.querySelector("main");
    let rebuildTimer: number | undefined;
    let scrollTimer: number | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts stay
      e.preventDefault();
      e.stopImmediatePropagation();
      // Esc is the way out at any moment — including a slow capture.
      if (e.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (capturingRef.current || e.repeat) return;
      if (e.key === "Enter" || e.key === " ") {
        if (Date.now() - startedAtRef.current < ENTER_GRACE_MS) return;
        const c = hoveredRef.current;
        if (c) onChooseRef.current(c);
        return;
      }
      const forward =
        e.key === "Tab" ? !e.shiftKey : e.key === "ArrowDown" || e.key === "ArrowRight" ? true : e.key === "ArrowUp" || e.key === "ArrowLeft" ? false : null;
      const list = indexRef.current?.list ?? [];
      if (forward === null || list.length === 0) return;
      const currentEl = hoveredRef.current?.el;
      const at = currentEl ? list.findIndex((c) => c.el === currentEl) : -1;
      const next = list[(at + (forward ? 1 : -1) + list.length) % list.length];
      revealInScroller(next.el, indexRef.current?.main ?? null);
      clearPending();
      setTouchPreview(false);
      setHover(next);
      window.setTimeout(redraw, 0);
    };

    const onScroll = () => {
      if (scrollTimer) return;
      scrollTimer = window.setTimeout(() => {
        scrollTimer = undefined;
        redraw();
      }, 16);
    };
    const onResize = () => {
      if (window.innerWidth < MIN_WIDTH) onCancelRef.current();
      else redraw();
    };
    const onFullscreen = () => onCancelRef.current();

    // A modal opening mid-inspect (the late announcement popup) owns the
    // screen now — step aside.
    const bodyWatch = new MutationObserver(() => {
      if (document.body.style.pointerEvents === "none") onCancelRef.current();
    });
    bodyWatch.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    // Cards appear/disappear (tabs, collapsibles, live data) — rebuild, debounced.
    const mainWatch = new MutationObserver(() => {
      window.clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(rebuild, REBUILD_DEBOUNCE_MS);
    });
    if (main) {
      mainWatch.observe(main, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class", "hidden", "data-state"],
      });
    }
    const resizeWatch = new ResizeObserver(() => redraw());
    if (main) resizeWatch.observe(main);
    // Crossing below the tablet breakpoint ends inspect mode. `resize` alone
    // isn't reliable for that (device emulation, rotation), so also listen
    // to the media query and re-check on the redraw tick.
    const tablet = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
    const onMedia = () => {
      if (!tablet.matches) onCancelRef.current();
    };
    tablet.addEventListener("change", onMedia);
    const tick = window.setInterval(() => {
      if (window.innerWidth < MIN_WIDTH) onCancelRef.current();
      else redraw();
    }, REDRAW_INTERVAL_MS);

    window.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFullscreen);
      tablet.removeEventListener("change", onMedia);
      bodyWatch.disconnect();
      mainWatch.disconnect();
      resizeWatch.disconnect();
      window.clearInterval(tick);
      window.clearTimeout(rebuildTimer);
      window.clearTimeout(scrollTimer);
    };
  }, [mounted, rebuild, redraw, setHover]);

  /* ── Pointer input (all of it lands on the catcher) ──────────────────── */

  const pointAt = (x: number, y: number) => (indexRef.current ? pickAt(indexRef.current, x, y) : null);

  const scrollAt = (x: number, y: number, dx: number, dy: number) => {
    const hit = document.elementsFromPoint(x, y).find((el) => !isReportUi(el)) ?? null;
    const main = indexRef.current?.main ?? document.querySelector("main");
    if (dy) scrollerFor(hit, "y", dy, main)?.scrollBy({ top: dy });
    if (dx) scrollerFor(hit, "x", dx, main)?.scrollBy({ left: dx });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (capturing) return;
    e.preventDefault(); // no text selection, no focus change
    pointerRef.current = {
      id: e.pointerId,
      type: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      dragged: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (capturing) return;
    const p = pointerRef.current;
    if (p && p.id === e.pointerId && e.pointerType !== "mouse") {
      // Finger / pen drag scrolls by hand — the catcher has touch-action:none.
      if (!p.dragged && Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_PX) p.dragged = true;
      if (p.dragged) {
        scrollAt(p.x, p.y, p.lastX - e.clientX, p.lastY - e.clientY);
        p.lastX = e.clientX;
        p.lastY = e.clientY;
      }
      return;
    }
    if (e.pointerType === "touch") return;
    const now = performance.now();
    if (now - lastMoveRef.current < MOVE_THROTTLE_MS) return;
    lastMoveRef.current = now;
    const target = pointAt(e.clientX, e.clientY)?.el ?? null;
    if (target === (hoveredRef.current?.el ?? null)) {
      clearPending(); // back on the highlighted part
      return;
    }
    if (pendingRef.current?.el === target) return; // already waiting on this part
    clearPending();
    const timer = window.setTimeout(() => {
      pendingRef.current = null;
      // The index may have been rebuilt meanwhile — use its current object.
      const fresh = target ? (indexRef.current?.map.get(target) ?? null) : null;
      setTouchPreview(false);
      setHover(fresh);
      draw();
    }, HOVER_DELAY_MS);
    pendingRef.current = { el: target, timer };
  };

  // Selection happens on CLICK only: choosing on pointerdown/up would let
  // the trailing click land on whatever is under the overlay once it's gone.
  const onClick = (e: React.MouseEvent) => {
    if (capturing) return;
    clearPending();
    const p = pointerRef.current;
    pointerRef.current = null;
    if (p?.dragged) return;
    const c = pointAt(e.clientX, e.clientY);
    if (!c) return;
    if ((p?.type ?? "mouse") === "touch") {
      if (touchPreview && hoveredRef.current?.el === c.el) {
        onChoose(c);
        return;
      }
      setHover(c);
      setTouchPreview(true);
      draw();
      return;
    }
    onChoose(c);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (capturing) return;
    scrollAt(e.clientX, e.clientY, wheelPixels(e.deltaX, e.deltaMode), wheelPixels(e.deltaY, e.deltaMode));
  };

  if (!mounted) return null;

  /* ── Highlight + chip geometry ───────────────────────────────────────── */

  // What's actually visible of the part — a scrolled section is cut at the
  // edge of its scroller instead of spilling over the top bar or footer.
  const vis = hovered?.el.isConnected ? visibleRect(hovered.el) : null;
  const box = vis ? { ...vis, right: vis.left + vis.width, bottom: vis.top + vis.height } : null;
  const rtl = document.documentElement.dir === "rtl";
  const chipBelow = box ? box.bottom + 56 < window.innerHeight : true;
  const chipTop = box ? (chipBelow ? Math.min(box.bottom + 8, window.innerHeight - 48) : Math.max(box.top - 44, 8)) : 0;
  const chipSide = box
    ? rtl
      ? { right: Math.max(8, Math.min(window.innerWidth - box.right, window.innerWidth - 240)) }
      : { left: Math.max(8, Math.min(box.left, window.innerWidth - 240)) }
    : {};
  const name = hovered ? nameOf(hovered) : null;
  // The card occupies roughly the top 70px; get out of the way of a part there.
  const cardAtBottom = Boolean(box && box.top < 70 && box.bottom < window.innerHeight - 100);

  return createPortal(
    <div
      {...{ [ATTR.ui]: "" }}
      data-slot="report-problem-inspector"
      className="pointer-events-none fixed inset-0 z-[10040] animate-in fade-in-0 duration-200"
    >
      <style>{HIGHLIGHT_CSS}</style>

      {/* Dim layer: one plain dark scrim — no outlines on the parts. A
          hovered part gets a cut-out (the box's huge shadow keeps the rest
          dark), stays dimmed while its border draws, then lights up. A new
          key per part replays the animation every time the hover moves. */}
      {box ? (
        <div
          key={`highlight-${hoverSeqRef.current}`}
          data-slot="report-problem-highlight"
          className="absolute rounded-md"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: `0 0 0 9999px ${SCRIM}`,
          }}
        >
          <div className="rp-light-up absolute inset-0 rounded-md" style={{ background: SCRIM }} />
          <svg
            aria-hidden
            className="absolute inset-0 overflow-visible"
            width={box.width}
            height={box.height}
          >
            <path
              className="rp-border-path stroke-blue-500"
              d={borderPath(box.width, box.height)}
              pathLength={1}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : (
        <div key="scrim" className="absolute inset-0" style={{ background: SCRIM }} />
      )}

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* The catcher — a plain div with no role, so SoundFxInit stays quiet. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-auto absolute inset-0 touch-none",
          capturing ? "cursor-progress" : hovered ? "cursor-pointer" : "cursor-crosshair",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse" && !capturing) {
            clearPending();
            setHover(null);
          }
        }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onCancel();
        }}
        onWheel={onWheel}
      />

      {/* Name chip next to the highlighted part. */}
      {box && name && (
        <div
          // New key per part: the chip appears once the border has finished drawing.
          key={hoverSeqRef.current}
          className={cn(
            "absolute flex max-w-[min(26rem,calc(100vw-1rem))] items-center gap-2 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs text-white shadow-lg",
            !capturing && "rp-after-draw",
            touchPreview && !capturing && "pointer-events-auto",
          )}
          style={{ top: chipTop, ...chipSide }}
        >
          {capturing ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : null}
          <span className="min-w-0 truncate">
            <span className="font-semibold">{name.kind}</span>
            {name.label && <span className="opacity-90"> · {name.label}</span>}
          </span>
          {capturing ? (
            <span className="shrink-0 opacity-90">{t("capturing")}</span>
          ) : touchPreview ? (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                onClick={() => hoveredRef.current && onChoose(hoveredRef.current)}
              >
                {t("reportThis")}
              </button>
              <button
                type="button"
                aria-label={t("cancel")}
                className="rounded-md px-1 py-0.5 text-white/90 hover:bg-white/15"
                onClick={() => {
                  setTouchPreview(false);
                  setHover(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span className="shrink-0 opacity-80">{t("clickToReport")}</span>
          )}
        </div>
      )}

      {/* Instruction pill — compact. Slides in as inspect mode opens. Pointer
          moves pass THROUGH it to the catcher (only Cancel takes clicks), and
          it moves to the bottom while the highlighted part sits under it —
          the top bar and page header stay pickable and visible. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 flex justify-center px-4",
          cardAtBottom ? "bottom-4" : "top-4",
        )}
      >
        <div
          key={cardAtBottom ? "bottom" : "top"}
          ref={barRef}
          tabIndex={-1}
          role="status"
          className={cn(
            "flex max-w-full items-center gap-3 rounded-full border bg-background/95 py-1.5 ps-1.5 pe-2 shadow-lg outline-none backdrop-blur animate-in fade-in-0 duration-300",
            cardAtBottom ? "slide-in-from-bottom-2" : "slide-in-from-top-2",
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 dark:bg-blue-500/20">
            {capturing ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {capturing ? t("capturing") : t("instruction")}
            </p>
            {!capturing && (
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {mode === "specific" ? t("hintSpecific") : t("hintGeneral")} {t("explain")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
              {t("escKey")}
            </kbd>
            <Button variant="outline" size="sm" className="pointer-events-auto h-7 rounded-full" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
