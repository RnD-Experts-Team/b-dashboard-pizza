import {
  TICKET_STATUSES,
  type TicketListFilters,
  type TicketStatus,
} from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Filters ⇄ URL query string, and filters → API query string.              */
/*  The URL form is what makes a filtered inbox linkable and reload-safe.    */
/* ────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_PER_PAGE = 25;
export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export const EMPTY_FILTERS: TicketListFilters = {
  statuses: [],
  sectionKeys: [],
  stores: [],
  reportedBy: null,
  search: "",
  page: 1,
  perPage: DEFAULT_PER_PAGE,
};

const STATUS_SET: ReadonlySet<string> = new Set(TICKET_STATUSES);

function positiveInt(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function filtersFromParams(params: URLSearchParams): TicketListFilters {
  const list = (key: string) =>
    (params.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const reportedBy = positiveInt(params.get("reported_by"), 0);
  return {
    statuses: list("status").filter((s): s is TicketStatus => STATUS_SET.has(s)),
    sectionKeys: list("section"),
    stores: list("store"),
    reportedBy: reportedBy || null,
    search: params.get("q") ?? "",
    page: positiveInt(params.get("page"), 1),
    perPage: Math.min(200, positiveInt(params.get("per_page"), DEFAULT_PER_PAGE)),
  };
}

/** Writes filters into a copy of `base`, keeping unrelated keys such as `tab`. */
export function filtersToParams(
  filters: TicketListFilters,
  base?: URLSearchParams,
): URLSearchParams {
  const out = new URLSearchParams(base);
  const set = (key: string, value: string | null) =>
    value ? out.set(key, value) : out.delete(key);
  set("status", filters.statuses.join(","));
  set("section", filters.sectionKeys.join(","));
  set("store", filters.stores.join(","));
  set("reported_by", filters.reportedBy ? String(filters.reportedBy) : null);
  set("q", filters.search.trim());
  set("page", filters.page > 1 ? String(filters.page) : null);
  set("per_page", filters.perPage !== DEFAULT_PER_PAGE ? String(filters.perPage) : null);
  return out;
}

/** API query: OR within a filter, AND across filters; arrays as `key[]`. */
export function filtersToApiQuery(
  filters: TicketListFilters,
  opts: { includeStores: boolean },
): string {
  const qs = new URLSearchParams();
  filters.statuses.forEach((s) => qs.append("statuses[]", s));
  filters.sectionKeys.forEach((k) => qs.append("section_keys[]", k));
  if (opts.includeStores) filters.stores.forEach((s) => qs.append("stores[]", s));
  if (filters.reportedBy) qs.set("reported_by", String(filters.reportedBy));
  if (filters.search.trim()) qs.set("search", filters.search.trim());
  qs.set("page", String(filters.page));
  qs.set("per_page", String(filters.perPage));
  return qs.toString();
}

export function activeFilterCount(
  filters: TicketListFilters,
  opts: { includeStores: boolean },
): number {
  return (
    (filters.statuses.length ? 1 : 0) +
    (filters.sectionKeys.length ? 1 : 0) +
    (opts.includeStores && filters.stores.length ? 1 : 0) +
    (filters.reportedBy ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  );
}
