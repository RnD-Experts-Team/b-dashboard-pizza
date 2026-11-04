import type { GridColumn, ReportResult, ResultWire } from "@/types/report-builder.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Wire → UI normalisation for preview and run-row responses. Pure.          */
/*                                                                            */
/*  Columns carry `id` (report columns) or `key` (raw dataset columns);       */
/*  paging is `page` as a number or a paginator object, with the total in     */
/*  `total`, `page.total` or `meta.row_count`. Laravel resources may wrap     */
/*  any body in `{ data: … }`.                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Unwraps a Laravel `{ data: … }` resource envelope when present. */
export function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body) {
    const keys = Object.keys(body);
    const wrapperOnly = keys.every((k) => ["data", "meta", "links", "success", "message"].includes(k));
    if (wrapperOnly) return (body as { data: T }).data;
  }
  return body as T;
}

/** Unwraps a list that may be a bare array, `{data:[…]}` or a paginator. */
export function unwrapList<T>(body: unknown): T[] {
  const inner = unwrap<unknown>(body);
  if (Array.isArray(inner)) return inner as T[];
  if (inner && typeof inner === "object" && Array.isArray((inner as { data?: unknown }).data))
    return (inner as { data: T[] }).data;
  return [];
}

const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function readTotal(wire: ResultWire): number | null {
  const page = typeof wire.page === "object" && wire.page ? wire.page : null;
  return finite(wire.total) ?? finite(page?.total) ?? finite(wire.meta?.["total"]) ?? finite(wire.meta?.["row_count"]);
}

function readPage(wire: ResultWire): number | null {
  if (typeof wire.page === "number") return wire.page;
  return finite(wire.page?.current_page);
}

function normalizeColumns(wire: ResultWire["columns"]): GridColumn[] {
  return (wire ?? []).map((c, i) => {
    const id = c.id ?? c.key ?? `col${i + 1}`;
    return { id, label: c.label ?? id, type: c.type ?? "string", format: c.format };
  });
}

export function normalizeResult(body: unknown): ReportResult {
  const wire = unwrap<ResultWire>(body) ?? { columns: [], rows: [] };
  return {
    columns: normalizeColumns(wire.columns),
    rows: Array.isArray(wire.rows) ? wire.rows : [],
    total: readTotal(wire),
    page: readPage(wire),
    meta: wire.meta ?? {},
  };
}

/** One row as `{ columnId: value }`, the shape formulas evaluate against. */
export function rowRecord(columns: GridColumn[], row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(columns.map((c, i) => [c.id, row[i]]));
}
