/* ────────────────────────────────────────────────────────────────────────── */
/*  Run grid query ⇄ URL — pure. Copy of lib/workbooks/grid-url.ts.           */
/*                                                                            */
/*  q=<search>  sort=<columnId>  order=asc|desc  page=<n>  per=<n>           */
/*                                                                            */
/*  `page`/`per` go to the server (`/runs/{id}/rows?page&per`, 25–200 rows);  */
/*  search and sort apply to the loaded page only.                            */
/* ────────────────────────────────────────────────────────────────────────── */

/** The server pages run rows 25–200 at a time. */
export const MIN_PER_PAGE = 25;
export const DEFAULT_PER_PAGE = 50;
const LARGE_PER_PAGE = 100;
export const MAX_PER_PAGE = 200;
export const PER_PAGE_CHOICES = [MIN_PER_PAGE, DEFAULT_PER_PAGE, LARGE_PER_PAGE, MAX_PER_PAGE] as const;

export interface GridQuery {
  search: string;
  sortId: string | null;
  sortOrder: "asc" | "desc";
  page: number;
  perPage: number;
}

// A report column id as it appears in the URL: "c3", "net_sales"; rejects "c 3" and "".
// Tester: https://regex101.com/?flavor=javascript&regex=%5E%5BA-Za-z0-9_.%5D%7B1%2C64%7D%24&testString=net_sales
const SORT_ID_RE = /^[A-Za-z0-9_.]{1,64}$/;

function positiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function gridQueryFromParams(params: URLSearchParams): GridQuery {
  const per = positiveInt(params.get("per"), DEFAULT_PER_PAGE);
  const sort = params.get("sort");
  return {
    search: params.get("q") ?? "",
    sortId: sort && SORT_ID_RE.test(sort) ? sort : null,
    sortOrder: params.get("order") === "desc" ? "desc" : "asc",
    page: positiveInt(params.get("page"), 1),
    perPage: (PER_PAGE_CHOICES as readonly number[]).includes(per) ? per : DEFAULT_PER_PAGE,
  };
}

/** Two search texts that differ only by surrounding whitespace are the same search (the URL stores it trimmed). */
export const sameSearch = (a: string, b: string): boolean => a.trim() === b.trim();

export function gridQueryToParams(q: GridQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.search?.trim()) p.set("q", q.search.trim());
  if (q.sortId != null) {
    p.set("sort", q.sortId);
    if (q.sortOrder === "desc") p.set("order", "desc");
  }
  if (q.page > 1) p.set("page", String(q.page));
  if (q.perPage !== DEFAULT_PER_PAGE) p.set("per", String(q.perPage));
  return p;
}

/** Header click: unsorted → asc → desc → unsorted. */
export function cycleSort(q: Pick<GridQuery, "sortId" | "sortOrder">, id: string): Pick<GridQuery, "sortId" | "sortOrder"> {
  if (q.sortId !== id) return { sortId: id, sortOrder: "asc" };
  if (q.sortOrder === "asc") return { sortId: id, sortOrder: "desc" };
  return { sortId: null, sortOrder: "asc" };
}
