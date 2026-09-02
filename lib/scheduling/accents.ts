/**
 * Status accents for the scheduling grid.
 *
 * The grid used to run six independent colour systems at once — a ten-hue
 * per-employee palette, four Actual statuses, five Compare outcomes, two
 * warning states that repainted the whole card, purple/slate day pills, and
 * tinted sync markers. Read together they were noise: the eye had no way to
 * tell which colour meant "look here" and which meant "this is Marco".
 *
 * This collapses all of it to three accents, following the rule already
 * documented in `components/cleaning/cleaning-ui.tsx`:
 *
 *   "a small solid colour bar + coloured text, no filled background. Keeps the
 *    UI low on saturated colour ("less colors") while still reading clearly at
 *    a glance."
 *
 * The `{ rail, text }` shape mirrors `{ bar, text }` in
 * `components/maintenance-tickets/status-accent.ts`, so the two features stay
 * recognisably the same idiom.
 *
 * ## Why `neutral` carries no colour
 *
 * A rail on every card would just be the old rainbow at 2px. The expected
 * cases — an ordinary planned shift, an actual that matched the plan — are
 * deliberately unmarked, so the only colour on screen belongs to something that
 * actually needs attention.
 */

export type ShiftTone = "neutral" | "attention" | "critical" | "info";

export interface ShiftAccent {
  /** Leading 2px rail. Empty for `neutral` — the caller renders nothing. */
  rail: string;
  /** Icon and emphasis text colour. */
  text: string;
}

export const SHIFT_ACCENT: Record<ShiftTone, ShiftAccent> = {
  neutral: { rail: "", text: "text-muted-foreground" },
  attention: {
    rail: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  critical: { rail: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  /**
   * Unplanned-but-worked coverage.
   *
   * Violet is the Labor dashboard's own colour — the `people` entry in
   * `components/dashboard-v1/category.ts`, re-exported as `PEOPLE` by
   * `components/labor/labor-chart.tsx` — so an unplanned person here reads as
   * the same subject the labor pages are about.
   *
   * The literals are inlined rather than imported: `category.ts` pulls in lucide
   * icon components, and this module is a pure token file with no dependencies.
   * Four places in `components/labor/**` inline the same strings already.
   *
   * Note this REPLACES sky rather than adding a hue. Sky still belongs to sync
   * state ("waiting to reach Humanity") in `shift-sync-badge.tsx` and friends —
   * a different concept that must not blur into this one.
   */
  info: { rail: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
};

/** True when this tone should draw a rail at all. */
export function hasRail(tone: ShiftTone): boolean {
  return tone !== "neutral";
}

/**
 * The neutral card surface shared by every shift card in every view.
 *
 * Exported as one constant precisely so the three card components cannot drift
 * apart again — the whole point is that a card looks the same whoever it
 * belongs to and whatever state it is in.
 */
export const SHIFT_CARD_SURFACE =
  "rounded-md border border-border bg-card hover:bg-accent/40";

/** The rail element's classes, minus the tone colour. Logical `start` for RTL. */
export const SHIFT_RAIL_BASE =
  "pointer-events-none absolute inset-y-0 start-0 w-0.5 rounded-s-md";
