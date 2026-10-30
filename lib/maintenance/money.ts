/**
 * Money, quantities and durations for maintenance v2 screens.
 *
 * The API sends money and hours as 2-decimal STRINGS ("1234.50"). Parse them
 * here — never `parseFloat(x).toFixed()` inline, which puts NaN on screen for
 * a missing value. Display rules (docs/MAINTENANCE-V2-UI.md rule 8): money
 * `$1,234.50`, hours `3h 25m`, always `tabular-nums` in the markup.
 */

const CENTS = 100;
const MINUTES_PER_HOUR = 60;

/** "12.50" / 12.5 → 12.5; null, "", "abc" → null. */
export function parseDecimal(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

/** Like parseDecimal, but 0 for anything missing (for sums). */
export function decimalOr0(raw: string | number | null | undefined): number {
  return parseDecimal(raw) ?? 0;
}

/** Rounds to cents, the way the server stores money. */
export function roundCents(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

/** A number as the API wants money: "1234.50". */
export function toMoneyString(value: number): string {
  return roundCents(value).toFixed(2);
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** $1,234.50; "—" for nothing. */
export function formatMoney(raw: string | number | null | undefined, empty = "—"): string {
  const n = parseDecimal(raw);
  return n == null ? empty : USD.format(n);
}

/** Minutes → "3h 25m" ("45m", "2h", "0m"). */
export function formatMinutes(minutes: number | null | undefined, empty = "—"): string {
  if (minutes == null || !Number.isFinite(minutes)) return empty;
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / MINUTES_PER_HOUR);
  const m = total % MINUTES_PER_HOUR;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Decimal hours ("3.42") → "3h 25m". */
export function formatHours(raw: string | number | null | undefined, empty = "—"): string {
  const h = parseDecimal(raw);
  return h == null ? empty : formatMinutes(h * MINUTES_PER_HOUR, empty);
}

/** Minutes → decimal hours, 2 places, as the hourly line sends it. */
export function minutesToHours(minutes: number): number {
  return roundCents(minutes / MINUTES_PER_HOUR);
}

/** A quantity: whole numbers without decimals ("3"), otherwise up to 2 ("2.5"). */
export function formatQuantity(raw: string | number | null | undefined, empty = "—"): string {
  const n = parseDecimal(raw);
  if (n == null) return empty;
  return Number.isInteger(n) ? String(n) : String(roundCents(n));
}
