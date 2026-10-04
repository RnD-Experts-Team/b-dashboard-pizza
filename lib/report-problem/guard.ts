/* ────────────────────────────────────────────────────────────────────────── */
/*  When inspect mode may start. Inspect mode puts a full-screen layer over  */
/*  everything, so it must never start on top of something that owns the    */
/*  screen: a modal, Screens fullscreen, the Drive Thru panel, PageGuide.   */
/* ────────────────────────────────────────────────────────────────────────── */

/** Tablets and up only (Tailwind `md`). */
export const MIN_WIDTH = 768;

export type StartBlock = "small" | "fullscreen" | "modal" | "covered";

/**
 * Why inspect mode can't start right now, or null. `trigger` is the button
 * that was pressed; if anything sits on top of it (the Drive Thru backdrop,
 * the Screens CSS takeover, PageGuide) the page belongs to that, not to us.
 */
export function startBlocker(trigger: Element | null): StartBlock | null {
  if (window.innerWidth < MIN_WIDTH) return "small";
  if (document.fullscreenElement) return "fullscreen";
  // Every Radix modal layer (dialogs, sheets, modal menus) switches this off.
  if (document.body.style.pointerEvents === "none") return "modal";
  if (trigger?.isConnected) {
    const r = trigger.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !trigger.contains(hit)) return "covered";
  }
  return null;
}

/** True when the trigger lives inside a sheet (the topnav hamburger menu). */
export function inSheet(trigger: Element | null): boolean {
  return Boolean(trigger?.closest('[data-slot="sheet-content"]'));
}

/**
 * After closing a sheet: wait until Radix has fully let go — content
 * unmounted (it stays during the close animation) and body pointer events
 * back. setTimeout, not rAF: rAF never fires in a background tab.
 */
export async function waitForSheetClosed(maxMs = 800): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const open = document.querySelector('[data-slot="sheet-content"]');
    if (!open && document.body.style.pointerEvents !== "none") return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}
