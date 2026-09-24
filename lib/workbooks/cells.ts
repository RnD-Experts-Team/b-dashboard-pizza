import type { CellValue, WorkbookColumn } from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cell reading and writing — pure.                                         */
/*                                                                            */
/*  Dates come back as ISO-8601 datetimes ("2026-09-23T00:00:00+00:00").     */
/*  NEVER `new Date()` them: in any timezone west of UTC that renders the    */
/*  day before. Take the calendar part of the string instead.                */
/*                                                                            */
/*  Numbers come back as strings and stay strings: "1.50" is "1.50".         */
/* ────────────────────────────────────────────────────────────────────────── */

const DATE_PART_RE = /^(\d{4}-\d{2}-\d{2})/;

/** "2026-09-23T00:00:00+00:00" → "2026-09-23". Anything else → "". */
export function datePart(value: CellValue): string {
  if (typeof value !== "string") return "";
  const m = value.match(DATE_PART_RE);
  return m ? m[1] : "";
}

/** "2026-09-23" → "Sep 23, 2026" without touching timezones. */
export function formatDateOnly(iso: string, locale = "en"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  // Constructed from parts in LOCAL time, so the day never shifts.
  const local = new Date(y, m - 1, d);
  try {
    return local.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function isBlank(value: CellValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Normalise a server value to a boolean, or null when blank. */
export function toBool(value: CellValue): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return null;
  const v = String(value).toLowerCase();
  if (["1", "true", "yes"].includes(v)) return true;
  if (["0", "false", "no"].includes(v)) return false;
  return null;
}

/** The string an editor starts from. */
export function toEditorValue(column: WorkbookColumn, value: CellValue): string {
  if (isBlank(value)) return "";
  switch (column.type) {
    case "date":
      return datePart(value);
    case "boolean": {
      const b = toBool(value);
      return b === null ? "" : b ? "true" : "false";
    }
    default:
      return String(value);
  }
}

/** What gets sent: strings, and `null` for blank. */
export function toWireValue(raw: string): string | null {
  return raw.trim() === "" ? null : raw;
}

/**
 * Light client-side shape check so a half-typed number doesn't round-trip
 * just to be refused. The server stays the authority (and answers 422
 * WORKBOOK_CELL_TYPE_MISMATCH anyway); this only catches the obvious.
 * Returns an i18n key under `workbooks.cell` or null.
 */
export function checkCellInput(column: WorkbookColumn, raw: string): string | null {
  const v = raw.trim();
  if (v === "") return column.required ? "required" : null;
  if (column.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) return "notNumber";
  if (column.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "notDate";
  if (column.type === "select" && column.options && !column.options.includes(v)) return "notOption";
  return null;
}

/** Stable ordering for display: position asc, then id. */
export function sortColumns(columns: WorkbookColumn[]): WorkbookColumn[] {
  return [...columns].sort((a, b) => a.position - b.position || a.id - b.id);
}
