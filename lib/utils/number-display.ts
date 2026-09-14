/* ────────────────────────────────────────────────────────────────────────── */
/*  Number formatting that cannot crash a render                             */
/*                                                                            */
/*  `(null).toFixed(2)` throws a TypeError. Inside a component that unwinds   */
/*  to the nearest error boundary, so ONE null figure blanks a whole panel —  */
/*  or a whole page where no boundary sits closer.                            */
/*                                                                            */
/*  That is not hypothetical: the maintenance analytics panel crashed exactly */
/*  this way. `avgTicketsPerWeek.value` was typed `number`, the API sends     */
/*  `null` when no tickets match the filter, and TypeScript cannot catch a    */
/*  type that lies about the wire.                                            */
/*                                                                            */
/*  ── Why an em dash and not 0 ───────────────────────────────────────────   */
/*  For an AVERAGE or a PERCENTAGE, null means "nothing to average", which is */
/*  a different claim from "the average is zero". Rendering 0 invents a fact. */
/*  For a COUNT, zero is the honest answer — use `?? 0` at those call sites   */
/*  rather than these helpers.                                                */
/*                                                                            */
/*  ── Drop-in guarantee ──────────────────────────────────────────────────   */
/*  For any value that works today, output is byte-identical to `.toFixed()`. */
/*  These only differ where the old code would have THROWN. So swapping a     */
/*  call site can turn a crash into a dash, and can never change a figure     */
/*  that already rendered.                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/** What every helper here renders when there is no number to show. */
export const NO_VALUE = "—";

type MaybeNumber = number | null | undefined;

function isRenderable(value: MaybeNumber): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * `value.toFixed(dp)`, or an em dash when there is no value.
 *
 * Identical output to `.toFixed(dp)` for every finite number.
 */
export function fmtFixed(value: MaybeNumber, dp = 2, fallback = NO_VALUE): string {
  return isRenderable(value) ? value.toFixed(dp) : fallback;
}

/** "$12.34", or an em dash. Negatives keep the sign outside the symbol. */
export function fmtMoney(value: MaybeNumber, dp = 2, fallback = NO_VALUE): string {
  if (!isRenderable(value)) return fallback;
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(dp)}`;
}

/** "12.3%", or an em dash. Expects a value already in percent units. */
export function fmtPercent(value: MaybeNumber, dp = 1, fallback = NO_VALUE): string {
  return isRenderable(value) ? `${value.toFixed(dp)}%` : fallback;
}

/**
 * For a COUNT rather than an average: null legitimately means zero.
 *
 * Separate from the helpers above so the choice is explicit at the call site —
 * "no tickets" and "zero per week" are different statements, and picking the
 * wrong one silently is how a dashboard starts lying.
 */
export function fmtCount(value: MaybeNumber): string {
  return isRenderable(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "0";
}
