/**
 * Ticket filters <-> query string.
 *
 * The URL is the single source of truth for what the list is showing, the same
 * way Daily Pay already works (`lib/../daily-pay/page.tsx`). Tickets previously
 * held filters only in the Zustand store, which meant a filtered view could not
 * be linked, bookmarked, or survive a refresh -- and the coordinator's whole job
 * is "look at this one".
 *
 * Lists are comma-joined rather than repeated keys, matching Daily Pay, so the
 * URL stays short enough to paste into a chat message.
 *
 * Pure: no React, no JSX, no store. Lives here rather than in the page so both
 * the list page and the ticket page can read the same links.
 */

import type {
  IssueStatus,
  PaymentStatusValue,
  Priority,
  TicketStatus,
  TicketType,
  TicketsFilters,
} from "@/types/maintenance-tickets.types";

/** Every key this module round-trips. Kept as ONE list so a new filter cannot
 *  be added to the parser and forgotten in the builder -- that drift is exactly
 *  what the FILTER_GROUPS table in tickets-filters.tsx exists to prevent. */
export const URL_FILTER_KEYS = [
  "q",
  "statuses",
  "priorities",
  "assigned_priorities",
  "issue_ids",
  "issue_statuses",
  "technician_ids",
  "creator_ids",
  "types",
  "stores",
  "payment_statuses",
  "part_cost_total_gt",
  "part_cost_single_gt",
  "created_from",
  "created_to",
  "assigned_from",
  "assigned_to",
  "changed_statuses",
  "changed_from",
  "changed_to",
  "trashed",
  "sort",
  "dir",
  "page",
  "per_page",
] as const;

function parseStringList(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function parseIntList(raw: string | null): number[] | undefined {
  const list = parseStringList(raw);
  if (!list) return undefined;
  const out = list.map(Number).filter((n) => Number.isFinite(n));
  return out.length ? out : undefined;
}

function parseNumber(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFiltersFromUrl(params: URLSearchParams): TicketsFilters {
  const f: TicketsFilters = {};

  const q = params.get("q")?.trim();
  if (q) f.q = q;

  // Enum lists are cast, not validated. A junk value in a hand-edited URL
  // reaches the API and comes back as an empty result, which is the honest
  // outcome -- silently dropping it would show unfiltered data under a filtered
  // URL, which is worse.
  const statuses = parseStringList(params.get("statuses"));
  if (statuses) f.statuses = statuses as TicketStatus[];

  const priorities = parseStringList(params.get("priorities"));
  if (priorities) f.priorities = priorities as Priority[];

  const assignedPriorities = parseStringList(params.get("assigned_priorities"));
  if (assignedPriorities) f.assigned_priorities = assignedPriorities as Priority[];

  const issueStatuses = parseStringList(params.get("issue_statuses"));
  if (issueStatuses) f.issue_statuses = issueStatuses as IssueStatus[];

  const changedStatuses = parseStringList(params.get("changed_statuses"));
  if (changedStatuses) f.changed_statuses = changedStatuses as IssueStatus[];

  const types = parseStringList(params.get("types"));
  if (types) f.types = types as TicketType[];

  const paymentStatuses = parseStringList(params.get("payment_statuses"));
  if (paymentStatuses) f.payment_statuses = paymentStatuses as PaymentStatusValue[];

  const issueIds = parseIntList(params.get("issue_ids"));
  if (issueIds) f.issue_ids = issueIds;

  const technicianIds = parseIntList(params.get("technician_ids"));
  if (technicianIds) f.technician_ids = technicianIds;

  const creatorIds = parseIntList(params.get("creator_ids"));
  if (creatorIds) f.creator_ids = creatorIds;

  const stores = parseStringList(params.get("stores"));
  if (stores) f.stores = stores;

  const totalGt = parseNumber(params.get("part_cost_total_gt"));
  if (totalGt != null) f.part_cost_total_gt = totalGt;

  const singleGt = parseNumber(params.get("part_cost_single_gt"));
  if (singleGt != null) f.part_cost_single_gt = singleGt;

  for (const key of ["created_from", "created_to", "assigned_from", "assigned_to", "changed_from", "changed_to"] as const) {
    const v = params.get(key);
    if (v) f[key] = v;
  }

  const trashed = params.get("trashed");
  if (trashed === "with" || trashed === "only") f.trashed = trashed;

  const sort = params.get("sort");
  if (sort) f.sort = sort;

  const dir = params.get("dir");
  if (dir === "asc" || dir === "desc") f.dir = dir;

  const page = parseNumber(params.get("page"));
  if (page != null && page > 1) f.page = page;

  const perPage = parseNumber(params.get("per_page"));
  if (perPage != null) f.per_page = perPage;

  return f;
}

export function buildUrlFromFilters(filters: TicketsFilters): string {
  const p = new URLSearchParams();

  if (filters.q?.trim()) p.set("q", filters.q.trim());

  const lists: Array<[string, Array<string | number> | undefined]> = [
    ["statuses", filters.statuses],
    ["priorities", filters.priorities],
    ["assigned_priorities", filters.assigned_priorities],
    ["issue_statuses", filters.issue_statuses],
    ["changed_statuses", filters.changed_statuses],
    ["types", filters.types],
    ["payment_statuses", filters.payment_statuses],
    ["issue_ids", filters.issue_ids],
    ["technician_ids", filters.technician_ids],
    ["creator_ids", filters.creator_ids],
    ["stores", filters.stores],
  ];
  for (const [key, value] of lists) {
    if (value?.length) p.set(key, value.join(","));
  }

  if (filters.part_cost_total_gt != null) p.set("part_cost_total_gt", String(filters.part_cost_total_gt));
  if (filters.part_cost_single_gt != null) p.set("part_cost_single_gt", String(filters.part_cost_single_gt));

  for (const key of ["created_from", "created_to", "assigned_from", "assigned_to", "changed_from", "changed_to"] as const) {
    const v = filters[key];
    if (v) p.set(key, v);
  }

  if (filters.trashed) p.set("trashed", filters.trashed);
  if (filters.sort) p.set("sort", filters.sort);
  if (filters.dir) p.set("dir", filters.dir);
  // Page 1 is the default, so it stays out of the URL -- otherwise every link
  // carries a ?page=1 that means nothing.
  if (filters.page && filters.page > 1) p.set("page", String(filters.page));
  if (filters.per_page) p.set("per_page", String(filters.per_page));

  return p.toString();
}

/** How many filters are actually narrowing the list. Drives the "clear" affordance.
 *  Deliberately excludes page, per_page, sort and dir -- those change the view,
 *  not the set, and counting them would make "3 filters" mean nothing. */
export function countActiveFilters(filters: TicketsFilters): number {
  let n = 0;
  if (filters.q?.trim()) n++;
  for (const v of [
    filters.statuses, filters.priorities, filters.assigned_priorities,
    filters.issue_statuses, filters.changed_statuses, filters.types,
    filters.payment_statuses, filters.issue_ids, filters.technician_ids,
    filters.creator_ids, filters.stores,
  ]) {
    if (v?.length) n++;
  }
  for (const v of [
    filters.part_cost_total_gt, filters.part_cost_single_gt,
  ]) {
    if (v != null) n++;
  }
  for (const v of [
    filters.created_from, filters.created_to,
    filters.assigned_from, filters.assigned_to,
    filters.changed_from, filters.changed_to, filters.trashed,
  ]) {
    if (v) n++;
  }
  return n;
}

/** Today, as the API wants it. Used by the "scheduled today" chip.
 *  Local date on purpose: the coordinator's "today" is their calendar day, and
 *  toISOString() would hand them yesterday every evening west of UTC. */
export function todayForApi(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
