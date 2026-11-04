import { toNumber } from "./formula";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cell formatting by column type — pure, shared by the preview and the run  */
/*  grid. Values arrive as JSON (preview) or as CSV text (run rows), so every */
/*  formatter accepts numbers AND numeric strings. An empty cell (null, "",   */
/*  a division by zero) renders as "", never "0".                             */
/*                                                                            */
/*  Digits stay Latin in Arabic too (`-u-nu-latn`), like money elsewhere in   */
/*  the portal. Dates are read from their calendar part, never shifted by a   */
/*  time zone.                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

interface FormatColumn {
  type: string;
  format?: string;
}

export interface CellLabels {
  yes: string;
  no: string;
}

const MONEY_DIGITS = 2;
const NUMBER_MAX_DIGITS = 2;
const PERCENT_DIGITS = 1;

const NUMERIC_TYPES: ReadonlySet<string> = new Set(["integer", "number", "money"]);

/** Effective display kind: a `format` (percent, money) wins over the type. */
function displayKind(column: FormatColumn): string {
  return column.format || column.type || "string";
}

export function isNumericColumn(column: FormatColumn): boolean {
  return NUMERIC_TYPES.has(column.type) || column.format === "percent" || column.format === "money";
}

const intlLocale = (locale: string) => `${locale === "ar" ? "ar" : "en-US"}-u-nu-latn`;

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string, kind: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${kind}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const created = new Intl.NumberFormat(intlLocale(locale), options);
  formatters.set(key, created);
  return created;
}

// Calendar part of an ISO date or datetime: "2026-10-21" and "2026-10-21T03:00:00Z"
// both give 2026, 10, 21; "21/10/2026" does not match.
// Tester: https://regex101.com/?flavor=javascript&regex=%5E(%5Cd%7B4%7D)-(%5Cd%7B2%7D)-(%5Cd%7B2%7D)&testString=2026-10-21T03%3A00%3A00Z
const ISO_DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function formatDate(value: unknown, locale: string): string {
  const m = String(value).match(ISO_DATE_PREFIX_RE);
  if (!m) return String(value);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(intlLocale(locale), { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: unknown, locale: string): string {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(intlLocale(locale), { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const TRUE_TEXT: ReadonlySet<string> = new Set(["1", "true", "yes", "t", "y"]);

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return TRUE_TEXT.has(String(value).trim().toLowerCase());
}

type Formatter = (value: unknown, locale: string, labels: CellLabels) => string;

const numeric = (kind: string, options: Intl.NumberFormatOptions, suffix = ""): Formatter => (value, locale) => {
  const n = toNumber(value);
  return n === null ? String(value) : `${numberFormat(locale, kind, options).format(n)}${suffix}`;
};

const FORMATTERS: Record<string, Formatter> = {
  money: numeric("money", { style: "currency", currency: "USD", minimumFractionDigits: MONEY_DIGITS, maximumFractionDigits: MONEY_DIGITS }),
  // Percent values are already ×100 (percent(a,b), "… * 100"), so no style:"percent".
  percent: numeric("percent", { minimumFractionDigits: PERCENT_DIGITS, maximumFractionDigits: PERCENT_DIGITS }, "%"),
  integer: numeric("integer", { maximumFractionDigits: 0 }),
  number: numeric("number", { maximumFractionDigits: NUMBER_MAX_DIGITS }),
  date: (value, locale) => formatDate(value, locale),
  datetime: (value, locale) => formatDateTime(value, locale),
  boolean: (value, _locale, labels) => (asBoolean(value) ? labels.yes : labels.no),
};

/** Display text of one cell. */
export function formatCell(value: unknown, column: FormatColumn, locale: string, labels: CellLabels): string {
  if (value === null || value === undefined || value === "") return "";
  const fmt = FORMATTERS[displayKind(column)];
  return fmt ? fmt(value, locale, labels) : String(value);
}

/** Sort comparison for one column: numbers numerically, everything else as text; empty cells last. */
export function compareCells(a: unknown, b: unknown, column: FormatColumn): number {
  const emptyA = a === null || a === undefined || a === "";
  const emptyB = b === null || b === undefined || b === "";
  if (emptyA || emptyB) return Number(emptyA) - Number(emptyB);
  if (isNumericColumn(column)) {
    const na = toNumber(a);
    const nb = toNumber(b);
    if (na !== null && nb !== null) return na - nb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
