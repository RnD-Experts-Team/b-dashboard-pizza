import axios from "axios";
import type {
  DailyPayEntry,
  DailyPayLine,
  DailyPayRevision,
  DailyPayTicketIssue,
  DailyPayListResponse,
  DailyPayEntryInput,
  DailyPayLineInput,
  DailyPayFilters,
  ApiDailyPayEntry,
  ApiDailyPayLine,
  ApiDailyPayRevision,
  ApiDailyPayTicketIssue,
  ApiDailyPayListResponse,
  ApiDailyPayEntryResponse,
} from "@/types/daily-pay.types";
import type {
  ApiTicketNote,
  ApiTicketAttachment,
  TicketNote,
  TicketAttachment,
  LaravelPaginationMeta,
  LaravelPaginationLinks,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type DailyPayErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "CANCELLED"
  | "UNKNOWN";

export class DailyPayError extends Error {
  readonly code: DailyPayErrorCode;
  readonly retryable: boolean;
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    code: DailyPayErrorCode,
    validationErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "DailyPayError";
    this.code = code;
    this.validationErrors = validationErrors;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

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
    throw new DailyPayError(
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
    throw new DailyPayError("Request cancelled.", "CANCELLED");
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message: string = data?.message || data?.error?.message || err.message;

    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      throw new DailyPayError("Request timed out. Please try again.", "TIMEOUT");
    }
    if (status === 401) throw new DailyPayError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new DailyPayError(message, "FORBIDDEN");
    if (status === 404) throw new DailyPayError(message, "NOT_FOUND");
    if (status === 422) {
      throw new DailyPayError(
        message || "Validation failed.",
        "VALIDATION_ERROR",
        data?.errors
      );
    }
    if (status === 429) throw new DailyPayError("Too many requests.", "RATE_LIMITED");
    if (status != null && status >= 500) {
      throw new DailyPayError("Server error. Please try again.", "SERVER_ERROR");
    }
    if (!err.response) {
      throw new DailyPayError("Network error. Check your connection.", "NETWORK_ERROR");
    }
  }
  throw new DailyPayError("An unexpected error occurred.", "UNKNOWN");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers (snake_case API → camelCase client)                   */
/* ────────────────────────────────────────────────────────────────────────── */

function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function transformAttachment(raw: ApiTicketAttachment): TicketAttachment {
  const fileName = raw.file_name ?? raw.original_name ?? raw.path ?? `attachment-${raw.id}`;
  return {
    id: raw.id,
    fileName,
    fileSize: raw.file_size ?? raw.size ?? null,
    contentType: raw.content_type ?? raw.mime_type ?? null,
    url: raw.url,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function transformNote(raw: ApiTicketNote): TicketNote {
  return {
    id: raw.id,
    type: raw.type,
    typeLabel: raw.type_label,
    body: raw.body,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: raw.creator
      ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email ?? null }
      : null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformTicketIssue(raw: ApiDailyPayTicketIssue): DailyPayTicketIssue {
  return {
    id: raw.id,
    ticketId: raw.ticket_id,
    storeNumber: raw.ticket?.store?.store_number ?? null,
    issueTitle: raw.issue?.title ?? null,
    otherTitle: raw.other_title,
    priority: raw.priority,
    status: raw.status,
    description: raw.description,
    technicians: (raw.technicians ?? []).map((t) => ({ id: t.id, name: t.name })),
  };
}

function transformLine(raw: ApiDailyPayLine): DailyPayLine {
  return {
    id: raw.id,
    dailyPayEntryId: raw.daily_pay_entry_id,
    technicianId: raw.technician_id,
    technician: raw.technician ? { id: raw.technician.id, name: raw.technician.name } : null,
    storeId: raw.store_id,
    store: raw.store ? { id: raw.store.id, storeNumber: raw.store.store_number } : null,
    totalWorkingHours: parseDecimal(raw.total_working_hours),
    gas: parseDecimal(raw.gas),
    invoices: parseDecimal(raw.invoices),
    hourlyPaymentRate: parseDecimal(raw.hourly_payment_rate),
    moneyOwed: parseDecimal(raw.money_owed),
    travelTime: parseDecimal(raw.travel_time),
    totalBreakTime: parseDecimal(raw.total_break_time),
    ticketIssues: (raw.ticket_issues ?? []).map(transformTicketIssue),
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: raw.creator
      ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email ?? null }
      : null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformRevision(raw: ApiDailyPayRevision): DailyPayRevision {
  return {
    id: raw.id,
    dailyPayEntryId: raw.daily_pay_entry_id,
    snapshot: raw.snapshot,
    editedBy: raw.edited_by,
    createdAt: raw.created_at,
  };
}

function transformEntry(raw: ApiDailyPayEntry): DailyPayEntry {
  return {
    id: raw.id,
    date: raw.date,
    lines: (raw.lines ?? []).map(transformLine),
    revisions: (raw.revisions ?? []).map(transformRevision),
    createdBy: raw.created_by ?? null,
    creator: raw.creator
      ? { id: raw.creator.id, name: raw.creator.name, email: raw.creator.email ?? null }
      : null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

/**
 * Normalises pagination metadata from either the nested resource envelope
 * ({ meta, links }) or Laravel's flat simple-pagination root.
 */
function transformPagination(raw: ApiDailyPayListResponse): {
  meta: LaravelPaginationMeta;
  links: LaravelPaginationLinks;
} {
  if (raw.meta) {
    return {
      meta: {
        currentPage: raw.meta.current_page,
        from: raw.meta.from,
        lastPage: raw.meta.last_page,
        perPage: raw.meta.per_page,
        to: raw.meta.to,
        total: raw.meta.total,
      },
      links: {
        first: raw.links?.first ?? null,
        last: raw.links?.last ?? null,
        prev: raw.links?.prev ?? null,
        next: raw.links?.next ?? null,
      },
    };
  }

  // Flat root, with sensible fallbacks for a single, unpaginated page.
  const total = raw.total ?? raw.data.length;
  const perPage = raw.per_page ?? (raw.data.length || 15);
  return {
    meta: {
      currentPage: raw.current_page ?? 1,
      from: raw.from ?? (raw.data.length ? 1 : null),
      lastPage: raw.last_page ?? 1,
      perPage,
      to: raw.to ?? (raw.data.length || null),
      total,
    },
    links: {
      first: raw.first_page_url ?? null,
      last: raw.last_page_url ?? null,
      prev: raw.prev_page_url ?? null,
      next: raw.next_page_url ?? null,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payload → request body builders                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/** True when the payload carries any File anywhere (line- or note-level). */
function payloadHasFiles(payload: DailyPayEntryInput): boolean {
  return payload.lines.some(
    (line) =>
      (line.files?.length ?? 0) > 0 ||
      (line.notes ?? []).some((note) => (note.files?.length ?? 0) > 0)
  );
}

/** Append a numeric line field only when it has a value. */
function appendNumber(form: FormData, key: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return;
  form.append(key, String(value));
}

/**
 * Builds multipart FormData using the bracket notation the API expects:
 *   lines[N][store_id], lines[N][files][], lines[N][notes][M][files][], …
 */
function buildEntryFormData(payload: DailyPayEntryInput): FormData {
  const form = new FormData();
  form.append("date", payload.date);

  payload.lines.forEach((line, i) => {
    const p = `lines[${i}]`;
    form.append(`${p}[store_id]`, String(line.storeId));
    form.append(`${p}[technician_id]`, String(line.technicianId));
    appendNumber(form, `${p}[total_working_hours]`, line.totalWorkingHours);
    appendNumber(form, `${p}[gas]`, line.gas);
    appendNumber(form, `${p}[invoices]`, line.invoices);
    appendNumber(form, `${p}[hourly_payment_rate]`, line.hourlyPaymentRate);
    appendNumber(form, `${p}[money_owed]`, line.moneyOwed);
    appendNumber(form, `${p}[travel_time]`, line.travelTime);
    appendNumber(form, `${p}[total_break_time]`, line.totalBreakTime);

    (line.ticketIssueIds ?? []).forEach((id) =>
      form.append(`${p}[ticket_issue_ids][]`, String(id))
    );

    (line.notes ?? []).forEach((note, j) => {
      form.append(`${p}[notes][${j}][body]`, note.body);
      if (note.type) form.append(`${p}[notes][${j}][type]`, note.type);
      (note.files ?? []).forEach((file) =>
        form.append(`${p}[notes][${j}][files][]`, file)
      );
    });

    (line.files ?? []).forEach((file) => form.append(`${p}[files][]`, file));
  });

  return form;
}

/** Builds a plain JSON body (used when there are no file uploads). */
function buildEntryJson(payload: DailyPayEntryInput): Record<string, unknown> {
  return {
    date: payload.date,
    lines: payload.lines.map((line: DailyPayLineInput) => {
      const out: Record<string, unknown> = {
        store_id: line.storeId,
        technician_id: line.technicianId,
      };
      if (line.totalWorkingHours != null) out.total_working_hours = line.totalWorkingHours;
      if (line.gas != null) out.gas = line.gas;
      if (line.invoices != null) out.invoices = line.invoices;
      if (line.hourlyPaymentRate != null) out.hourly_payment_rate = line.hourlyPaymentRate;
      if (line.moneyOwed != null) out.money_owed = line.moneyOwed;
      if (line.travelTime != null) out.travel_time = line.travelTime;
      if (line.totalBreakTime != null) out.total_break_time = line.totalBreakTime;
      if (line.ticketIssueIds?.length) out.ticket_issue_ids = line.ticketIssueIds;
      if (line.notes?.length) {
        out.notes = line.notes.map((note) => ({
          body: note.body,
          ...(note.type ? { type: note.type } : {}),
        }));
      }
      return out;
    }),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE = "/api/daily-pay-entries";

export const dailyPayService = {
  /** Paginated list of daily pay entries with optional filters. */
  async listEntries(
    filters?: DailyPayFilters,
    signal?: AbortSignal
  ): Promise<DailyPayListResponse> {
    const token = requireToken();
    const params: Record<string, string | number | number[]> = {};
    if (filters?.technician_ids?.length) params.technician_ids = filters.technician_ids;
    if (filters?.store_ids?.length) params.store_ids = filters.store_ids;
    if (filters?.date) params.date = filters.date;
    if (filters?.date_from) params.date_from = filters.date_from;
    if (filters?.date_to) params.date_to = filters.date_to;
    if (filters?.filled_by) params.filled_by = filters.filled_by;
    if (filters?.sort) params.sort = filters.sort;
    if (filters?.dir) params.dir = filters.dir;
    if (filters?.per_page) params.per_page = filters.per_page;
    if (filters?.page) params.page = filters.page;

    try {
      const res = await axios.get<ApiDailyPayListResponse>(BASE, {
        params,
        // Axios serialises arrays as `key[]=a&key[]=b` by default.
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 15_000,
        signal,
      });
      const { meta, links } = transformPagination(res.data);
      return {
        data: (res.data.data ?? []).map(transformEntry),
        links,
        meta,
      };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Full detail of a single entry (lines, notes, attachments, revisions). */
  async getEntry(id: number, signal?: AbortSignal): Promise<DailyPayEntry> {
    const token = requireToken();
    try {
      const res = await axios.get<ApiDailyPayEntryResponse>(`${BASE}/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 15_000,
        signal,
      });
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Create a new daily pay entry. */
  async createEntry(payload: DailyPayEntryInput): Promise<DailyPayEntry> {
    const token = requireToken();
    const hasFiles = payloadHasFiles(payload);
    const body = hasFiles ? buildEntryFormData(payload) : buildEntryJson(payload);
    try {
      const res = await axios.post<ApiDailyPayEntryResponse>(BASE, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(hasFiles ? {} : { "Content-Type": "application/json" }),
        },
        timeout: 30_000,
      });
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Replace the full content of an existing entry (snapshots prior state). */
  async editEntry(id: number, payload: DailyPayEntryInput): Promise<DailyPayEntry> {
    const token = requireToken();
    const hasFiles = payloadHasFiles(payload);
    const body = hasFiles ? buildEntryFormData(payload) : buildEntryJson(payload);
    try {
      const res = await axios.post<ApiDailyPayEntryResponse>(`${BASE}/${id}/edit`, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(hasFiles ? {} : { "Content-Type": "application/json" }),
        },
        timeout: 30_000,
      });
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },
};
