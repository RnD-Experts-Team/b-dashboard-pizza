import axios from "axios";
import type {
  AnalyticsActivityPage,
  AnalyticsParams,
  AnalyticsSummary,
  AnalyticsWatchlist,
} from "@/types/maintenance-analytics.types";
import type { TechnicianAnalytics, TechnicianAnalyticsParams, TechniciansOverview } from "@/types/technician-analytics.types";
import type {
  TicketsListResponse,
  CatalogIssue,
  CreateTicketPayload,
  CreateNotePayload,
  TicketsFilters,
  ApiTicketsListResponse,
  ApiTicket,
  ApiTicketAttachment,
  ApiTicketNote,
  TicketNote,
  ApiCatalogIssue,
  EnumField,
  Ticket,
  TicketAttachment,
  LaravelPaginationMeta,
  LaravelPaginationLinks,
  ApiTicketsAnalytics,
  ApiTicketsAnalyticsDuration,
  ApiTicketsAnalyticsResponse,
  ApiIssueHistoryResponse,
  ApiIssueHistoryRow,
  ApiTroubleshootingGuide,
  IssueTroubleshooting,
  TroubleshootingGuide,
  TroubleshootingGuideInput,
  ApiTicketNoteWithOwner,
  TicketNoteWithOwner,
  TroubleshootingLibraryItem,
  IssueHistoryPage,
  IssueHistoryRow,
  TicketsAnalytics,
  TicketsAnalyticsDuration,
} from "@/types/maintenance-tickets.types";
import { BUSY_MESSAGE } from "@/lib/api/utils/error";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

import { MaintenanceTicketsError, type TicketsErrorCode } from "@/lib/api/maintenance-error";

// The error class lives in lib/api/maintenance-error.ts (shared by the
// maintenance services); re-exported here so existing imports keep working.
export { MaintenanceTicketsError };
export type { TicketsErrorCode };

/* ────────────────────────────────────────────────────────────────────────── */
/*  Token helper                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function requireToken(): string {
  const token = getToken();
  if (!token) {
    throw new MaintenanceTicketsError(
      "You must be logged in to perform this action.",
      "NOT_AUTHENTICATED"
    );
  }
  return token;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Axios error handler                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function handleAxiosError(err: unknown): never {
  // Cancelled / aborted requests — not a user-visible error
  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    throw new MaintenanceTicketsError("Request cancelled.", "CANCELLED");
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message: string = data?.message || data?.error?.message || err.message;

    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      throw new MaintenanceTicketsError("Request timed out. Please try again.", "TIMEOUT");
    }
    if (status === 401) throw new MaintenanceTicketsError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new MaintenanceTicketsError(message, "FORBIDDEN");
    if (status === 404) throw new MaintenanceTicketsError(message, "NOT_FOUND");
    if (status === 422) {
      throw new MaintenanceTicketsError(
        message || "Validation failed.",
        "VALIDATION_ERROR",
        data?.errors,
        data?.context
      );
    }
    if (status === 409) {
      throw new MaintenanceTicketsError(
        message || "Someone else changed this at the same moment. Reload and try again.",
        "CONFLICT"
      );
    }
    if (status === 429) throw new MaintenanceTicketsError("Too many requests.", "RATE_LIMITED");
    if (status != null && status >= 500) {
      throw new MaintenanceTicketsError(status === 503 ? BUSY_MESSAGE : "Server error. Please try again.", "SERVER_ERROR");
    }
    if (!err.response) {
      throw new MaintenanceTicketsError("Network error. Check your connection.", "NETWORK_ERROR");
    }
  }
  throw new MaintenanceTicketsError("An unexpected error occurred.", "UNKNOWN");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function transformEnumField(raw: { value: string; label: string }): EnumField {
  return { value: raw.value, label: raw.label };
}

/** A list issue's status: the server sends `"in_review"` with `status_label`; older servers `{value, label}`. */
function issueStatusOf(raw: { value: string; label: string } | string | null | undefined, label?: string | null): EnumField | null {
  if (!raw) return null;
  return typeof raw === "string" ? { value: raw, label: label ?? raw } : transformEnumField(raw);
}






function transformTicket(raw: ApiTicket): Ticket {
  return {
    id: raw.id,
    storeId: raw.store_id != null ? (raw.store?.store_number ?? String(raw.store_id)) : null,
    otherStore: raw.other_store ?? null,
    type: raw.type ? transformEnumField(raw.type) : null,
    status: transformEnumField(raw.status),
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    creator: raw.creator ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email ?? null } : null,
    issueCount: raw.issues_count ?? raw.issues?.length ?? 0,
    // The list already eager-loads these upstream, so carrying them costs
    // nothing and lets the rail put a ticket in a basket without opening it.
    issues: (raw.issues ?? []).map((i) => ({
      id: i.id,
      title: i.display_title ?? i.catalog_issue?.title ?? i.title ?? `Issue #${i.id}`,
      status: issueStatusOf(i.status, i.status_label),
      priority: i.priority ? transformEnumField(i.priority) : null,
      technicians: (i.technicians ?? []).map((t) => ({ id: t.id, name: t.name })),
      targetCompletionAt: i.target_completion_at ?? null,
    })),
    issueTitles: (raw.issues ?? [])
      .map((i) => i.display_title ?? i.catalog_issue?.title ?? i.title ?? null)
      .filter((t): t is string => !!t),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    deletedAt: raw.deleted_at,
  };
}

/**
 * Analytics is ALL aggregates, and the API sends `null` — or omits a block
 * entirely — whenever there is nothing to aggregate: no tickets, or a filter
 * combination matching none.
 *
 * Every access below is therefore optional-chained. The transform is the one
 * place API reality meets our types, so it guards here and hands the UI a
 * shape that tells the truth, instead of every render site having to remember.
 *
 * Counts fall back to 0 (a count of nothing IS zero). AVERAGES fall back to
 * null, never 0 — "no tickets" is not "zero tickets per week", and the panel
 * renders an em dash for it.
 */
function transformTicketsAnalytics(raw: ApiTicketsAnalytics): TicketsAnalytics {
  const dur = (d: ApiTicketsAnalyticsDuration | null | undefined): TicketsAnalyticsDuration => ({
    avgSeconds: d?.avg_seconds ?? null,
    avgHours: d?.avg_hours ?? null,
    sampleSize: d?.sample_size ?? 0,
  });

  const week = raw.avg_tickets_per_week;

  return {
    issues: {
      total: raw.issues?.total ?? 0,
      statusBreakdown: (raw.issues?.status_breakdown ?? []).map((b) => ({
        status: b.status,
        label: b.label,
        count: b.count,
      })),
    },
    // `?? null`, never `?? 0`. An older backend omits `attention` entirely, and
    // rendering 0 would claim nothing is overdue when we simply weren't told.
    attention: {
      overdue: raw.attention?.overdue ?? null,
      stuck: raw.attention?.stuck ?? null,
      asOf: raw.attention?.as_of ?? null,
    },
    durations: {
      pendingToNextStatus: dur(raw.durations?.pending_to_next_status),
      timeToCompleteOrCancelled: dur(raw.durations?.time_to_complete_or_cancelled),
    },
    avgTicketsPerWeek: {
      value: week?.value ?? null,
      totalTickets: week?.total_tickets ?? null,
      weeksSpanned: week?.weeks_spanned ?? null,
      spanStart: week?.span_start ?? null,
      spanEnd: week?.span_end ?? null,
      weekStartsOn: week?.week_starts_on ?? null,
    },
  };
}

/** Reads meta from the flat (simple) pagination root */
function transformMeta(raw: ApiTicketsListResponse): LaravelPaginationMeta {
  return {
    currentPage: raw.current_page,
    from: raw.from,
    lastPage: raw.last_page,
    perPage: raw.per_page,
    to: raw.to,
    total: raw.total,
  };
}

/** Reads navigation URLs from the flat pagination root */
function transformLinks(raw: ApiTicketsListResponse): LaravelPaginationLinks {
  return {
    first: raw.first_page_url,
    last: raw.last_page_url,
    prev: raw.prev_page_url,
    next: raw.next_page_url,
  };
}


export function transformTroubleshootingGuide(raw: ApiTroubleshootingGuide): TroubleshootingGuide {
  return {
    id: raw.id,
    issueId: raw.issue_id,
    title: raw.title,
    steps: (raw.steps ?? []).map((step) => ({
      id: step.id,
      position: step.position,
      body: step.body,
      attachments: (step.attachments ?? []).map(transformAttachment),
    })),
    linkUrl: raw.link_url,
    version: raw.version,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    editor: raw.editor ?? null,
    updatedAt: raw.updated_at,
    fixedCount: raw.fixed_count ?? 0,
    notFixedCount: raw.not_fixed_count ?? 0,
  };
}


function transformCatalogIssue(raw: ApiCatalogIssue): CatalogIssue {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    troubleshootingGuidesCount: raw.troubleshooting_guides_count ?? null,
    deletedAt: raw.deleted_at,
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
  };
}



function transformIssueHistoryRow(raw: ApiIssueHistoryRow): IssueHistoryRow {
  return {
    ticketId: raw.ticket_id,
    storeNumber: raw.store_number,
    createdAt: raw.created_at,
    creator: raw.creator ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email } : null,
    status: raw.status ? transformEnumField(raw.status) : null,
    completedAt: raw.completed_at,
    technicians: raw.technicians ?? [],
    issues: (raw.issues ?? []).map((i) => ({
      id: i.id,
      parentId: i.parent_id,
      status: transformEnumField(i.status),
      priority: transformEnumField(i.priority),
      assignedPriority: i.assigned_priority ? transformEnumField(i.assigned_priority) : null,
      description: i.description,
      completedAt: i.completed_at,
      createdAt: i.created_at,
    })),
  };
}

/** `&trashed=with` when the caller wants deleted catalog rows too (the catalog screen's "Show deleted"). */
function trashedParam(opts?: { includeDeleted?: boolean }): string {
  return opts?.includeDeleted ? "&trashed=with" : "";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  FormData builder (multipart endpoints that accept file attachments)    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Converts a plain payload + optional files into a FormData instance.
 * Arrays are serialised as `key[]` entries; undefined values are skipped.
 * When no files are supplied, callers should use the raw JSON payload instead
 * so that Content-Type defaults to application/json.
 */
function buildFormData(payload: object, files?: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      (value as unknown[]).forEach((item) => form.append(`${key}[]`, String(item)));
    } else {
      form.append(key, String(value));
    }
  }
  files?.forEach((file) => form.append("files[]", file));
  return form;
}

/**
 * Builds a multipart FormData for createTicket when the payload includes
 * file attachments. Handles the nested issues[N][...] field naming required
 * by the API, and supports both camelCase (type definitions) and snake_case
 * (dialog usage) for issueId / otherTitle.
 */
function buildTicketFormData(payload: CreateTicketPayload): FormData {
  const form = new FormData();

  payload.issues.forEach((issue, i) => {
    const raw = issue as unknown as Record<string, unknown>;

    form.append(`issues[${i}][description]`, issue.description);
    form.append(`issues[${i}][priority]`, issue.priority);

    const issueId = raw.issue_id ?? raw.issueId;
    if (issueId != null) form.append(`issues[${i}][issue_id]`, String(issueId));

    const otherTitle = raw.other_title ?? raw.otherTitle;
    if (otherTitle) form.append(`issues[${i}][other_title]`, String(otherTitle));

    (issue.notes ?? []).forEach((note, j) => {
      form.append(`issues[${i}][notes][${j}][body]`, note.body);
      if (note.type) form.append(`issues[${i}][notes][${j}][type]`, note.type);
    });

    (issue.files ?? []).forEach((file) => form.append(`issues[${i}][files][]`, file));

    // Per-issue fields (MAINTENANCE §2 "Create a ticket").
    if (issue.impact) form.append(`issues[${i}][impact]`, issue.impact);
    if (issue.contactName) form.append(`issues[${i}][contact_name]`, issue.contactName);
    if (issue.contactPhone) form.append(`issues[${i}][contact_phone]`, issue.contactPhone);

    // How troubleshooting went, and which guide (and version) it was, if any.
    if (issue.troubleshooting) {
      form.append(`issues[${i}][troubleshooting]`, issue.troubleshooting);
      if (issue.troubleshooting_guide_id != null) {
        form.append(`issues[${i}][troubleshooting_guide_id]`, String(issue.troubleshooting_guide_id));
      }
      if (issue.troubleshooting_version != null) {
        form.append(`issues[${i}][troubleshooting_version]`, String(issue.troubleshooting_version));
      }
    }
  });

  (payload.notes ?? []).forEach((note, j) => {
    form.append(`notes[${j}][body]`, note.body);
    if (note.type) form.append(`notes[${j}][type]`, note.type);
  });

  (payload.files ?? []).forEach((file) => form.append(`files[]`, file));

  if (payload.type) form.append("type", payload.type);

  return form;
}


function buildFilterParams(filters: TicketsFilters): URLSearchParams {
  const p = new URLSearchParams();
  // Trimmed, and omitted when empty: a bare `?q=` is a no-op server-side, but
  // sending it puts a meaningless key in the shareable URL.
  const q = filters.q?.trim();
  if (q) p.set("q", q);
  if (filters.assigned_from) p.set("assigned_from", filters.assigned_from);
  if (filters.assigned_to)   p.set("assigned_to",   filters.assigned_to);
  (filters.statuses ?? []).forEach((v) => v && p.append("statuses[]", v));
  (filters.priorities ?? []).forEach((v) => v && p.append("priorities[]", v));
  (filters.assigned_priorities ?? []).forEach((v) => v && p.append("assigned_priorities[]", v));
  (filters.issue_ids ?? []).forEach((v) => p.append("issue_ids[]", String(v)));
  (filters.issue_statuses ?? []).forEach((v) => v && p.append("issue_statuses[]", v));
  (filters.technician_ids ?? []).forEach((v) => p.append("technician_ids[]", String(v)));
  (filters.types ?? []).forEach((v) => p.append("types[]", v));
  (filters.stores ?? []).forEach((v) => v && p.append("stores[]", v));
  (filters.creator_ids ?? []).forEach((v) => p.append("creator_ids[]", String(v)));
  (filters.payment_statuses ?? []).forEach((v) => v && p.append("payment_statuses[]", v));
  if (filters.part_cost_total_gt != null) p.set("part_cost_total_gt", String(filters.part_cost_total_gt));
  if (filters.part_cost_single_gt != null) p.set("part_cost_single_gt", String(filters.part_cost_single_gt));
  if (filters.created_from)  p.set("created_from",  filters.created_from);
  if (filters.created_to)    p.set("created_to",    filters.created_to);
  (filters.changed_statuses ?? []).forEach((v) => v && p.append("changed_statuses[]", v));
  if (filters.changed_from)  p.set("changed_from",  filters.changed_from);
  if (filters.changed_to)    p.set("changed_to",    filters.changed_to);
  if (filters.trashed)       p.set("trashed",       filters.trashed);
  if (filters.sort)          p.set("sort",          filters.sort);
  if (filters.dir)           p.set("dir",           filters.dir);
  if (filters.page)          p.set("page",          String(filters.page));
  if (filters.per_page)      p.set("per_page",      String(filters.per_page));
  return p;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Lifecycle record transform helpers                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export function transformAttachment(raw: ApiTicketAttachment): TicketAttachment {
  const fileName = raw.file_name ?? raw.original_name ?? raw.path ?? `attachment-${raw.id}`;
  const fileSize = raw.file_size ?? raw.size ?? null;
  const contentType = raw.content_type ?? raw.mime_type ?? null;

  return {
    id: raw.id,
    fileName,
    fileSize,
    contentType,
    url: raw.url,
    kind: raw.kind ?? null,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

export function transformNote(raw: ApiTicketNote): TicketNote {
  return {
    id: raw.id,
    type: raw.type,
    typeLabel: raw.type_label,
    body: raw.body,
    isPrivate: raw.is_private ?? false,
    lockedAt: raw.locked_at ?? null,
    locker: raw.locker ?? null,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: raw.creator ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email ?? null } : null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}














/* ────────────────────────────────────────────────────────────────────────── */
/*  Entity path builders (for generic addNote / addAttachments)             */
/* ────────────────────────────────────────────────────────────────────────── */


export const entityPaths = {
  ticket: (store: string, ticket: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}`,
  ticketIssue: (store: string, ticket: number, issue: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/issues/${issue}`,
  diagnosis: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/diagnoses/${id}`,
  attendance: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/attendance-entries/${id}`,
  partUsage: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/part-usages/${id}`,
  payEntry: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/pay-entries/${id}`,
  warranty: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/warranties/${id}`,
  assignment: (store: string, ticket: number, id: number) =>
    `/stores/${encodeURIComponent(store)}/tickets/${ticket}/assignments/${id}`,
  store: (store: string) => `/stores/${encodeURIComponent(store)}`,
  catalogIssue: (id: number) => `/catalog/issues/${id}`,
  technician: (id: number) => `/catalog/technicians/${id}`,
  category: (id: number) => `/catalog/categories/${id}`,
  part: (id: number) => `/catalog/parts/${id}`,
  // Global — no store segment, matching the routes.
  storageLocation: (id: number) => `/storage-locations/${id}`,
  stockMovement: (id: number) => `/stock-movements/${id}`,
} as const;

/**
 * GET /maintenance-analytics/{section}. Stores go as repeated stores[] keys;
 * the range as the two UTC instants the page computed from its local days.
 */
async function analyticsGet<T>(
  section: "summary" | "activity" | "watchlist",
  params: AnalyticsParams,
  extra: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const token = requireToken();
  const qs = new URLSearchParams();
  params.stores.forEach((store) => qs.append("stores[]", store));
  qs.set("from", params.from);
  qs.set("to", params.to);
  if (params.recurringMin) qs.set("recurring_min", String(params.recurringMin));
  if (params.recurringDays) qs.set("recurring_days", String(params.recurringDays));
  if (params.untouchedDays) qs.set("untouched_days", String(params.untouchedDays));
  for (const [key, value] of Object.entries(extra)) qs.set(key, value);

  try {
    const res = await axios.get<T>(`/api/maintenance-tickets/analytics/${section}?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 60_000,
      signal,
    });
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}

async function technicianAnalyticsGet<T>(url: string, params: TechnicianAnalyticsParams, signal?: AbortSignal): Promise<T> {
  const token = requireToken();
  const qs = new URLSearchParams();
  qs.set("from", params.from);
  qs.set("to", params.to);
  qs.set("date_from", params.dateFrom);
  qs.set("date_to", params.dateTo);
  (params.stores ?? []).forEach((store) => qs.append("stores[]", store));
  (params.issueIds ?? []).forEach((id) => qs.append("issue_ids[]", String(id)));
  (params.categoryIds ?? []).forEach((id) => qs.append("category_ids[]", String(id)));

  try {
    const res = await axios.get<T>(`${url}?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 60_000,
      signal,
    });
    return res.data;
  } catch (err) {
    return handleAxiosError(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const maintenanceTicketsService = {
  /** List tickets for a store with optional filters */
  async getTickets(
    storeId: string,
    filters?: TicketsFilters,
    signal?: AbortSignal
  ): Promise<TicketsListResponse> {
    const token = requireToken();
    const qs = filters ? buildFilterParams(filters).toString() : "";
    const url = `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets${qs ? `?${qs}` : ""}`;

    try {
      const res = await axios.get<ApiTicketsListResponse>(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 15_000,
        signal,
      });
      return {
        data: res.data.data.map(transformTicket),
        links: transformLinks(res.data),
        meta: transformMeta(res.data),
      };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Aggregate analytics for a store's tickets, scoped by the same filters as the list */
  async getTicketsAnalytics(
    storeId: string,
    filters?: TicketsFilters,
    signal?: AbortSignal
  ): Promise<TicketsAnalytics> {
    const token = requireToken();
    const qs = filters ? buildFilterParams(filters).toString() : "";
    const url = `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/analytics${qs ? `?${qs}` : ""}`;

    try {
      const res = await axios.get<ApiTicketsAnalyticsResponse>(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 15_000,
        signal,
      });
      return transformTicketsAnalytics(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Create a new ticket for a store */
  async createTicket(
    storeId: string,
    payload: CreateTicketPayload
  ): Promise<{ data: Ticket }> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiTicket }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets`,
        buildTicketFormData(payload),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 120_000, // generous: issues can carry file attachments
        }
      );
      return { data: transformTicket(res.data.data) };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Create a ticket for a location that is not a system store ("Others" flow) */
  async createTicketOther(
    otherStore: string,
    payload: CreateTicketPayload
  ): Promise<{ data: Ticket }> {
    const token = requireToken();
    const form = buildTicketFormData(payload);
    form.append("other_store", otherStore);
    try {
      const res = await axios.post<{ data: ApiTicket }>(
        `/api/maintenance-tickets/tickets`,
        form,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 120_000, // generous: issues can carry file attachments
        }
      );
      return { data: transformTicket(res.data.data) };
    } catch (err) {
      return handleAxiosError(err);
    }
  },











  /**
   * Add a free-text note to ANY entity. Pass the entity's relative path
   * (use the `entityPaths` helper). Multipart; supports file attachments.
   */
  async addNote(
    entityPath: string,
    payload: CreateNotePayload,
    files?: File[]
  ): Promise<TicketNote> {
    const token = requireToken();
    const body = buildFormData(payload, files);
    try {
      const res = await axios.post<{ data: ApiTicketNote }>(
        `/api/maintenance-tickets${entityPath}/notes`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 120_000 }
      );
      return transformNote(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Lock (private: MOS only) or unlock a note anywhere on a ticket. Needs the
   * private-notes permission; the change is logged on the ticket.
   */
  /**
   * Every note on a ticket -- its own, its issues', its records' -- each with
   * what it sits on. `all` reads the locked ones too: ask for it only when the
   * auth rules allow it (GET .../notes/all), the normal list otherwise.
   */
  async getTicketNotes(storeNumber: string, ticketId: number, all: boolean, signal?: AbortSignal): Promise<TicketNoteWithOwner[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiTicketNoteWithOwner[] }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeNumber)}/tickets/${ticketId}/notes${all ? "/all" : ""}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return (res.data.data ?? []).map((raw) => ({ ...transformNote(raw), owner: raw.owner }));
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  async setNotePrivacy(storeNumber: string, ticketId: number, noteId: number, isPrivate: boolean): Promise<TicketNote> {
    const token = requireToken();
    try {
      const res = await axios.patch<{ data: ApiTicketNote }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeNumber)}/tickets/${ticketId}/notes/${noteId}/privacy`,
        { is_private: isPrivate },
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformNote(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Upload one or more file attachments to ANY entity (multipart). */
  async addAttachments(
    entityPath: string,
    files: File[]
  ): Promise<TicketAttachment[]> {
    const token = requireToken();
    const body = buildFormData({}, files);
    try {
      const res = await axios.post<{ data: ApiTicketAttachment[] }>(
        `/api/maintenance-tickets${entityPath}/attachments`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 120_000 }
      );
      return (res.data.data ?? []).map(transformAttachment);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Load catalog issues (for dropdowns). Requests a large page so all issues come back in one shot. */
  async getCatalogIssues(
    signal?: AbortSignal,
    storeId?: string,
    opts?: { includeDeleted?: boolean },
  ): Promise<CatalogIssue[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiCatalogIssue[] }>(
        `/api/maintenance-tickets/catalog/issues?per_page=1000${trashedParam(opts)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(storeId ? { "X-Store-Id": storeId } : {}),
          },
          timeout: 15_000,
          signal,
        }
      );
      return (res.data.data ?? []).map(transformCatalogIssue);
    } catch (err) {
      return handleAxiosError(err);
    }
  },



  /** Every technician's pay and work in a range -- the Technicians page. */
  async getTechniciansAnalytics(params: TechnicianAnalyticsParams, signal?: AbortSignal): Promise<TechniciansOverview> {
    return technicianAnalyticsGet<{ data: TechniciansOverview }>("/api/maintenance-tickets/technician-analytics", params, signal).then((r) => r.data);
  },

  /** One technician's pay and work in a range. */
  async getTechnicianAnalytics(id: number, params: TechnicianAnalyticsParams, signal?: AbortSignal): Promise<TechnicianAnalytics> {
    return technicianAnalyticsGet<{ data: TechnicianAnalytics }>(`/api/maintenance-tickets/catalog/technicians/${id}/analytics`, params, signal).then((r) => r.data);
  },



  /* ── Catalog CRUD ─────────────────────────────────────────────────────── */

  async createCatalogIssue(payload: { title: string; description?: string }, storeId?: string): Promise<CatalogIssue> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiCatalogIssue }>(
        "/api/maintenance-tickets/catalog/issues",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(storeId ? { "X-Store-Id": storeId } : {}),
          },
          timeout: 15_000,
        }
      );
      return transformCatalogIssue(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  async deleteCatalogIssue(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/catalog/issues/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  async restoreCatalogIssue(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(`/api/maintenance-tickets/catalog/issues/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },









  /* ── Catalog edits (partial: only the fields sent change) ──────────────── */

  async updateCatalogIssue(id: number, payload: { title?: string; description?: string | null }): Promise<CatalogIssue> {
    const token = requireToken();
    try {
      const res = await axios.patch<{ data: ApiCatalogIssue }>(
        `/api/maintenance-tickets/catalog/issues/${id}`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformCatalogIssue(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },




  /**
   * Earlier tickets at a store that reported the same catalog issue
   * ("this store's last Oven tickets"), newest first, one row per ticket.
   */
  async getIssueHistory(
    storeNumber: string,
    issueId: number,
    opts: { excludeTicketId?: number; openOnly?: boolean; page?: number; perPage?: number } = {},
    signal?: AbortSignal,
  ): Promise<IssueHistoryPage> {
    const token = requireToken();
    const params = new URLSearchParams();
    if (opts.excludeTicketId) params.set("exclude_ticket", String(opts.excludeTicketId));
    if (opts.openOnly) params.set("open_only", "1");
    params.set("per_page", String(opts.perPage ?? 10));
    params.set("page", String(opts.page ?? 1));
    try {
      const res = await axios.get<ApiIssueHistoryResponse>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeNumber)}/issues/${issueId}/history?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return {
        rows: (res.data.data ?? []).map(transformIssueHistoryRow),
        page: res.data.current_page ?? 1,
        lastPage: res.data.last_page ?? 1,
        total: res.data.total ?? 0,
      };
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Troubleshooting guides ────────────────────────────────────────────── */

  /** Every catalog issue that has guides -- the library (titles and counts). */
  async getTroubleshootingLibrary(storeId?: string, signal?: AbortSignal): Promise<TroubleshootingLibraryItem[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{
        data: Array<{
          issue_id: number;
          title: string;
          description: string | null;
          guides: Array<{ id: number; title: string; steps_count: number; version: number; fixed_count: number; not_fixed_count: number; updated_at: string }>;
        }>;
      }>("/api/maintenance-tickets/troubleshooting", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(storeId ? { "X-Store-Id": storeId } : {}) },
        timeout: 15_000,
        signal,
      });
      return (res.data.data ?? []).map((row) => ({
        issueId: row.issue_id,
        title: row.title,
        description: row.description,
        guides: (row.guides ?? []).map((g) => ({
          id: g.id,
          title: g.title,
          stepsCount: g.steps_count,
          version: g.version,
          fixedCount: g.fixed_count,
          notFixedCount: g.not_fixed_count,
          updatedAt: g.updated_at,
        })),
      }));
    } catch (err) { return handleAxiosError(err); }
  },

  /** One issue and all its guides -- the troubleshooting page. */
  async getIssueTroubleshooting(issueId: number, signal?: AbortSignal, storeId?: string | null): Promise<IssueTroubleshooting> {
    const token = requireToken();
    try {
      const res = await axios.get<{
        data: { issue_id: number; title: string; description: string | null; guides: ApiTroubleshootingGuide[] };
      }>(`/api/maintenance-tickets/catalog/issues/${issueId}/troubleshooting`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(storeId ? { "X-Store-Id": storeId } : {}) },
        timeout: 15_000,
        signal,
      });
      const d = res.data.data;
      return {
        issueId: d.issue_id,
        title: d.title,
        description: d.description,
        guides: (d.guides ?? []).map(transformTroubleshootingGuide),
      };
    } catch (err) { return handleAxiosError(err); }
  },

  async createTroubleshootingGuide(issueId: number, payload: TroubleshootingGuideInput): Promise<TroubleshootingGuide> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiTroubleshootingGuide }>(
        `/api/maintenance-tickets/catalog/issues/${issueId}/troubleshooting`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformTroubleshootingGuide(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Replace a guide; every save is a new version. Steps keep their id (and files). */
  async updateTroubleshootingGuide(guideId: number, payload: TroubleshootingGuideInput): Promise<TroubleshootingGuide> {
    const token = requireToken();
    try {
      const res = await axios.put<{ data: ApiTroubleshootingGuide }>(
        `/api/maintenance-tickets/troubleshooting/${guideId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformTroubleshootingGuide(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  async deleteTroubleshootingGuide(guideId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/troubleshooting/${guideId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  /** Files for the whole guide. */
  async addTroubleshootingFiles(guideId: number, files: File[]): Promise<TicketAttachment[]> {
    const token = requireToken();
    const body = new FormData();
    files.forEach((file) => body.append("files[]", file));
    try {
      const res = await axios.post<{ data: ApiTicketAttachment[] }>(
        `/api/maintenance-tickets/troubleshooting/${guideId}/attachments`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 120_000 }
      );
      return (res.data.data ?? []).map(transformAttachment);
    } catch (err) { return handleAxiosError(err); }
  },

  async removeTroubleshootingFile(guideId: number, attachmentId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/troubleshooting/${guideId}/attachments/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  /** Files for one step. */
  async addTroubleshootingStepFiles(stepId: number, files: File[]): Promise<TicketAttachment[]> {
    const token = requireToken();
    const body = new FormData();
    files.forEach((file) => body.append("files[]", file));
    try {
      const res = await axios.post<{ data: ApiTicketAttachment[] }>(
        `/api/maintenance-tickets/troubleshooting/steps/${stepId}/attachments`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 120_000 }
      );
      return (res.data.data ?? []).map(transformAttachment);
    } catch (err) { return handleAxiosError(err); }
  },

  async removeTroubleshootingStepFile(stepId: number, attachmentId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/troubleshooting/steps/${stepId}/attachments/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  /**
   * "This fixed it": troubleshooting solved the problem at this store, so no
   * ticket is opened. Naming the guide is optional.
   */
  async logTroubleshootingFix(storeId: string, issueId: number, guideId: number | null): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/troubleshooting-fixes`,
        { issue_id: issueId, troubleshooting_guide_id: guideId },
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Technician abilities ──────────────────────────────────────────────── */





  /* ── Analytics ─────────────────────────────────────────────────────────── */

  async getAnalyticsSummary(params: AnalyticsParams, signal?: AbortSignal): Promise<AnalyticsSummary> {
    const res = await analyticsGet<{ data: AnalyticsSummary }>("summary", params, {}, signal);
    return res.data;
  },

  async getAnalyticsActivity(params: AnalyticsParams, page = 1, signal?: AbortSignal): Promise<AnalyticsActivityPage> {
    return analyticsGet<AnalyticsActivityPage>("activity", params, { page: String(page), per_page: "25" }, signal);
  },

  async getAnalyticsWatchlist(params: AnalyticsParams, signal?: AbortSignal): Promise<AnalyticsWatchlist> {
    const res = await analyticsGet<{ data: AnalyticsWatchlist }>("watchlist", params, {}, signal);
    return res.data;
  },

  /* ── Ticket lifecycle ──────────────────────────────────────────────────── */

  /** Soft-delete a ticket (recoverable via restoreTicket) */
  async deleteTicket(storeId: string, ticketId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /** Restore a soft-deleted ticket */
  async restoreTicket(storeId: string, ticketId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/restore`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /** Cancel a ticket (terminal status) */
  async cancelTicket(storeId: string, ticketId: number, payload?: { reason?: string }): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/cancel`,
        payload ?? {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /** List tickets across all stores (no store scope) */
  async getGlobalTickets(filters?: TicketsFilters, signal?: AbortSignal): Promise<TicketsListResponse> {
    const token = requireToken();
    const qs = filters ? buildFilterParams(filters).toString() : "";
    const url = `/api/maintenance-tickets/tickets${qs ? `?${qs}` : ""}`;
    try {
      const res = await axios.get<ApiTicketsListResponse>(
        url,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return {
        data: res.data.data.map(transformTicket),
        links: transformLinks(res.data),
        meta: transformMeta(res.data),
      };
    } catch (err) { return handleAxiosError(err); }
  },

  /** Aggregate analytics across all stores, scoped by the same filters as the global list */
  async getGlobalTicketsAnalytics(filters?: TicketsFilters, signal?: AbortSignal): Promise<TicketsAnalytics> {
    const token = requireToken();
    const qs = filters ? buildFilterParams(filters).toString() : "";
    const url = `/api/maintenance-tickets/tickets/analytics${qs ? `?${qs}` : ""}`;
    try {
      const res = await axios.get<ApiTicketsAnalyticsResponse>(
        url,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return transformTicketsAnalytics(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },


  /* ── Assignment mutations ──────────────────────────────────────────────── */




  /* ── Diagnoses ─────────────────────────────────────────────────────────── */



  /* ── Attendance entries ────────────────────────────────────────────────── */




  /* ── Attendance events ─────────────────────────────────────────────────── */

  /*
   * Attendance is an append-only event ledger. Each call below writes ONE
   * thing that happened and gets the whole session back, so the UI never has
   * to guess what the server made of it.
   *
   * This is what the old shape had no room for: after creating an entry, the
   * only mutation in the entire API was "mistaken = true", so adding a travel
   * start to a saved clock-in meant flagging the record wrong and retyping it.
   */




  /* ── Part usages ───────────────────────────────────────────────────────── */



  /* ── Pay entries ───────────────────────────────────────────────────────── */



  /* ── Warranties ────────────────────────────────────────────────────────── */





  /* ── Export ────────────────────────────────────────────────────────────── */

  /** Returns the proxied export URL — call via plain anchor/window.open */
  getExportUrl(): string {
    return "/api/maintenance-tickets/export";
  },

  /** Fetch export as a blob and trigger browser download */
  async downloadExport(): Promise<void> {
    const token = requireToken();
    try {
      const res = await axios.get("/api/maintenance-tickets/export", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        responseType: "blob",
        timeout: 30_000,
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers["content-disposition"] as string | undefined;
      const nameMatch = disposition?.match(/filename[^;=\n]*=([^;\n"]*)/);
      a.download = nameMatch?.[1]?.trim() || "maintenance-export.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      return handleAxiosError(err);
    }
  },
};
