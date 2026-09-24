import type { RowsQuery } from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Grid query ⇄ URL — pure. Mirrors lib/maintenance-tickets/filters-url.ts. */
/*                                                                            */
/*  q=<search>  sort=<columnId>  order=asc|desc  page=<n>  per=<n>           */
/*  f.<columnId>=<value>  (one per active column filter)                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const PER_PAGE_CHOICES = [25, 50, 100, 200] as const;
export const DEFAULT_PER_PAGE = 25;

export const EMPTY_ROWS_QUERY: RowsQuery = {
  search: "",
  filters: {},
  sortColumn: null,
  sortOrder: "asc",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function rowsQueryFromParams(params: URLSearchParams): RowsQuery {
  const filters: Record<string, string> = {};
  params.forEach((value, key) => {
    const m = key.match(/^f\.(\d+)$/);
    if (m && value !== "") filters[m[1]] = value;
  });
  const per = positiveInt(params.get("per"), DEFAULT_PER_PAGE);
  const sort = params.get("sort");
  return {
    search: params.get("q") ?? "",
    filters,
    sortColumn: sort && /^\d+$/.test(sort) ? Number(sort) : null,
    sortOrder: params.get("order") === "desc" ? "desc" : "asc",
    page: positiveInt(params.get("page"), 1),
    perPage: (PER_PAGE_CHOICES as readonly number[]).includes(per) ? per : DEFAULT_PER_PAGE,
  };
}

export function rowsQueryToParams(q: RowsQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.search?.trim()) p.set("q", q.search.trim());
  if (q.sortColumn != null) {
    p.set("sort", String(q.sortColumn));
    if (q.sortOrder === "desc") p.set("order", "desc");
  }
  if (q.page > 1) p.set("page", String(q.page));
  if (q.perPage !== DEFAULT_PER_PAGE) p.set("per", String(q.perPage));
  for (const [col, value] of Object.entries(q.filters)) {
    if (value !== "") p.set(`f.${col}`, value);
  }
  return p;
}

export function activeFilterCount(q: RowsQuery): number {
  return Object.values(q.filters).filter((v) => v !== "").length + (q.search?.trim() ? 1 : 0);
}

/** Drag-reorder only makes sense on the manual order, unfiltered. */
export function isManualOrder(q: RowsQuery): boolean {
  return q.sortColumn == null && activeFilterCount(q) === 0;
}
