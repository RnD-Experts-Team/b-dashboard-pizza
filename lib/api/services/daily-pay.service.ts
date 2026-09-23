import axios from "axios";
import type {
  DailyPayEntry,
  DailyPayGathered,
  DailyPayLine,
  DailyPayPayment,
  DailyPayAggregationWarning,
  DailyPayRevision,
  DailyPayTicketIssue,
  DailyPayListResponse,
  DailyPayEntryInput,
  DailyPayNoteInput,
  DailyPayFilters,
  ApiDailyPayEntry,
  ApiDailyPayGathered,
  ApiDailyPayLine,
  ApiDailyPayPayment,
  ApiDailyPayAggregationWarning,
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
  UserRef,
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
  | "CONFLICT"
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
  /**
   * Present on 409 when the body carries the current server timestamp — lets
   * the caller re-arm `expected_updated_at` without a second GET.
   */
  readonly serverUpdatedAt?: string | null;

  constructor(
    message: string,
    code: DailyPayErrorCode,
    validationErrors?: Record<string, string[]>,
    serverUpdatedAt?: string | null
  ) {
    super(message);
    this.name = "DailyPayError";
    this.code = code;
    this.validationErrors = validationErrors;
    this.serverUpdatedAt = serverUpdatedAt;
    // CONFLICT is deliberately NOT retryable: a blind retry would clobber the
    // other person's figures, which is the exact thing expected_updated_at
    // exists to prevent.
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
    // A stale edit — someone else saved since we last read the entry.
    if (status === 409) {
      throw new DailyPayError(
        message || "This entry changed since you opened it.",
        "CONFLICT",
        undefined,
        data?.data?.updated_at ?? data?.updated_at ?? null
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

/**
 * Maps a relation while PRESERVING the null-vs-empty distinction:
 * null/undefined ⇒ null ("not loaded"), [] ⇒ [] ("loaded, nothing there").
 *
 * Used instead of `?? []` everywhere, because collapsing them shows "no notes"
 * for a record whose notes simply were not requested.
 */
function mapRelation<R, T>(
  raw: R[] | null | undefined,
  fn: (r: R) => T
): T[] | null {
  return raw == null ? null : raw.map(fn);
}

function transformUserRef(
  raw: { id: number; name: string; email?: string | null } | null | undefined
): UserRef | null {
  return raw ? { id: raw.id, name: raw.name, email: raw.email ?? null } : null;
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
    creator: transformUserRef(raw.creator),
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

function transformGathered(
  raw: ApiDailyPayGathered | null | undefined
): DailyPayGathered | null {
  if (raw == null) return null;
  return {
    workHours: parseDecimal(raw.work_hours),
    travelHours: parseDecimal(raw.travel_hours),
    breakHours: parseDecimal(raw.break_hours),
    partsRunHours: parseDecimal(raw.parts_run_hours),
    reimbursableParts: parseDecimal(raw.reimbursable_parts),
    at: raw.at,
    by: transformUserRef(raw.by),
  };
}

function transformWarning(
  raw: ApiDailyPayAggregationWarning
): DailyPayAggregationWarning {
  return {
    code: raw.code,
    // Deliberately `?? {}` rather than null — unlike every other relation
    // here — because callers read keys off this object.
    context: raw.context ?? {},
  };
}

function transformLine(raw: ApiDailyPayLine): DailyPayLine {
  return {
    id: raw.id,
    dailyPayPaymentId: raw.daily_pay_payment_id,
    storeId: raw.store_id,
    store: raw.store ? { id: raw.store.id, storeNumber: raw.store.store_number } : null,
    otherStore: raw.other_store,
    totalWorkingHours: parseDecimal(raw.total_working_hours),
    hoursOverridden: raw.hours_overridden ?? false,
    lumpSum: parseDecimal(raw.lump_sum),
    hourlyPaymentRate: parseDecimal(raw.hourly_payment_rate),
    gas: parseDecimal(raw.gas),
    moneyOwed: parseDecimal(raw.money_owed),
    lineTotal: parseDecimal(raw.line_total),
    gathered: transformGathered(raw.gathered),
    ticketIssues: mapRelation(raw.ticket_issues, transformTicketIssue),
    notes: mapRelation(raw.notes, transformNote),
    attachments: mapRelation(raw.attachments, transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: transformUserRef(raw.creator),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformPayment(raw: ApiDailyPayPayment): DailyPayPayment {
  return {
    id: raw.id,
    dailyPayEntryId: raw.daily_pay_entry_id,
    technicianId: raw.technician_id,
    technician: raw.technician
      ? { id: raw.technician.id, name: raw.technician.name }
      : null,
    hourlyPaymentRate: parseDecimal(raw.hourly_payment_rate),
    gas: parseDecimal(raw.gas),
    moneyOwed: parseDecimal(raw.money_owed),
    lumpSum: parseDecimal(raw.lump_sum),
    totalAmount: parseDecimal(raw.total_amount),
    linesTotal: parseDecimal(raw.lines_total),
    gathered: transformGathered(raw.gathered),
    aggregationWarnings: mapRelation(raw.aggregation_warnings, transformWarning),
    lines: mapRelation(raw.lines, transformLine),
    notes: mapRelation(raw.notes, transformNote),
    attachments: mapRelation(raw.attachments, transformAttachment),
    createdBy: raw.created_by ?? null,
    creator: transformUserRef(raw.creator),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformRevision(raw: ApiDailyPayRevision): DailyPayRevision {
  return {
    id: raw.id,
    dailyPayEntryId: raw.daily_pay_entry_id,
    snapshot: raw.snapshot,
    schemaVersion: raw.schema_version ?? null,
    editedBy: raw.edited_by,
    editor: transformUserRef(raw.editor),
    createdAt: raw.created_at,
  };
}

function transformEntry(raw: ApiDailyPayEntry): DailyPayEntry {
  return {
    id: raw.id,
    date: raw.date,
    payments: mapRelation(raw.payments, transformPayment),
    totalAmount: parseDecimal(raw.total_amount),
    revisions: mapRelation(raw.revisions, transformRevision),
    createdBy: raw.created_by ?? null,
    creator: transformUserRef(raw.creator),
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
/*  Payload → request body builder                                          */
/*                                                                            */
/*  Always multipart. There is no JSON path, deliberately:                   */
/*                                                                            */
/*   - Two builders that must stay byte-identical in bracket semantics is the */
/*     duplication that drifts, and drift here is INVISIBLE — a wrong index   */
/*     produces a successful request with silently missing data, not an error.*/
/*   - Nothing is gained: the proxy route forwards the raw body with the      */
/*     incoming Content-Type, and Laravel validates dotted array keys the     */
/*     same way for both encodings, so 422 keys are identical either way.     */
/*   - Multipart cannot express `null`, which is a FEATURE here: it forces    */
/*     omit-to-gather to be the only representable behaviour.                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Appends an optional money / rate field.
 *
 * Skips only null and undefined, so a legitimate 0 IS sent. A non-finite value
 * THROWS rather than being silently dropped: for override fields a missing key
 * changes the meaning (an intended override becomes a gather), so swallowing a
 * malformed number would quietly pay the wrong amount.
 */
function appendMoney(
  form: FormData,
  key: string,
  value: number | null | undefined
): void {
  if (value == null) return;
  if (!Number.isFinite(value)) {
    throw new DailyPayError(`Invalid number for ${key}.`, "VALIDATION_ERROR", {
      [key]: ["Enter a valid number."],
    });
  }
  form.append(key, String(value));
}

/**
 * Appends a note list under `<prefix>[notes][k][…]`.
 *
 * Callers MUST pass an already-compacted array: indexes have to run
 * contiguously from 0, or the server drops that note's files without erroring.
 */
function appendNotes(
  form: FormData,
  prefix: string,
  notes: DailyPayNoteInput[] | undefined
): void {
  (notes ?? []).forEach((note, k) => {
    form.append(`${prefix}[notes][${k}][body]`, note.body);
    if (note.type) form.append(`${prefix}[notes][${k}][type]`, note.type);
    (note.files ?? []).forEach((file) =>
      form.append(`${prefix}[notes][${k}][files][]`, file)
    );
  });
}

/**
 * Builds the multipart body using the bracket notation the API expects:
 *   payments[i][technician_id]
 *   payments[i][lines][j][store_id]
 *   payments[i][lines][j][files][]
 *   payments[i][lines][j][notes][k][files][]
 *
 * Every index comes from a forEach position and never from a filter applied
 * afterwards — that is what guarantees contiguity.
 */
function buildEntryFormData(payload: DailyPayEntryInput): FormData {
  const form = new FormData();
  form.append("date", payload.date);
  if (payload.expectedUpdatedAt) {
    form.append("expected_updated_at", payload.expectedUpdatedAt);
  }

  payload.payments.forEach((payment, i) => {
    const p = `payments[${i}]`;
    form.append(`${p}[technician_id]`, String(payment.technicianId));
    appendMoney(form, `${p}[hourly_payment_rate]`, payment.hourlyPaymentRate);
    appendMoney(form, `${p}[gas]`, payment.gas);
    appendMoney(form, `${p}[money_owed]`, payment.moneyOwed);
    // A payment lump sum replaces ALL of its lines' labour.
    if (payment.labour.kind === "lumpSum") {
      appendMoney(form, `${p}[lump_sum]`, payment.labour.lumpSum);
    }
    appendNotes(form, p, payment.notes);
    (payment.files ?? []).forEach((file) => form.append(`${p}[files][]`, file));

    payment.lines.forEach((line, j) => {
      const l = `${p}[lines][${j}]`;

      // store_id XOR other_store — sending neither is a 422.
      if (line.location.kind === "store") {
        form.append(`${l}[store_id]`, String(line.location.storeId));
      } else {
        form.append(`${l}[other_store]`, line.location.otherStore);
      }

      (line.ticketIssueIds ?? []).forEach((id) =>
        form.append(`${l}[ticket_issue_ids][]`, String(id))
      );

      // Labour: exactly one branch emits a key. "gather" emits NOTHING, which
      // is how the backend is told to pull the hours from attendance.
      if (line.labour.kind === "hours") {
        // 0 is a legitimate override and MUST be sent — hence String() rather
        // than appendMoney's null check being relied on for anything here.
        form.append(`${l}[total_working_hours]`, String(line.labour.totalWorkingHours));
      } else if (line.labour.kind === "lumpSum") {
        appendMoney(form, `${l}[lump_sum]`, line.labour.lumpSum);
      }

      // A rate alongside a lump sum is meaningless — the lump sum replaces it.
      if (line.labour.kind !== "lumpSum") {
        appendMoney(form, `${l}[hourly_payment_rate]`, line.hourlyPaymentRate);
      }
      appendMoney(form, `${l}[gas]`, line.gas);
      appendMoney(form, `${l}[money_owed]`, line.moneyOwed);

      appendNotes(form, l, line.notes);
      (line.files ?? []).forEach((file) => form.append(`${l}[files][]`, file));
    });
  });

  return form;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const BASE = "/api/daily-pay-entries";

/** Multipart: let the browser set the boundary, so no Content-Type here. */
function multipartHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

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
    if (filters?.filled_by?.length) params.filled_by = filters.filled_by;
    if (filters?.created_from) params.created_from = filters.created_from;
    if (filters?.created_to) params.created_to = filters.created_to;
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

  /**
   * Full detail of a single entry: payments → lines → issues → notes →
   * attachments, plus a gathered block at both levels, and revisions.
   * Deeper than the list, hence the longer timeout.
   */
  async getEntry(id: number, signal?: AbortSignal): Promise<DailyPayEntry> {
    const token = requireToken();
    try {
      const res = await axios.get<ApiDailyPayEntryResponse>(`${BASE}/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 30_000,
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
    const body = buildEntryFormData(payload);
    try {
      const res = await axios.post<ApiDailyPayEntryResponse>(BASE, body, {
        headers: multipartHeaders(token),
        // Matches the proxy route's own 120s ceiling — a shorter client
        // timeout would abort photo uploads that the proxy is still happy with.
        timeout: 120_000,
      });
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Replace the full content of an existing entry (snapshots prior state).
   *
   * Pass `expectedUpdatedAt` to get a CONFLICT instead of silently overwriting
   * someone else's concurrent save.
   */
  async editEntry(id: number, payload: DailyPayEntryInput): Promise<DailyPayEntry> {
    const token = requireToken();
    const body = buildEntryFormData(payload);
    try {
      const res = await axios.post<ApiDailyPayEntryResponse>(`${BASE}/${id}/edit`, body, {
        headers: multipartHeaders(token),
        timeout: 120_000,
      });
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Re-pull the frozen `gathered` figures (hours, reimbursable parts) from the
   * attendance records.
   *
   * Idempotent, and deliberately leaves lines with `hoursOverridden: true`
   * untouched — surface that in the UI or it reads as a broken button.
   *
   * Bumps the entry's `updated_at`, so a caller holding an
   * `expectedUpdatedAt` must re-arm it from the result.
   */
  async recalculateEntry(id: number, signal?: AbortSignal): Promise<DailyPayEntry> {
    const token = requireToken();
    try {
      const res = await axios.post<ApiDailyPayEntryResponse>(
        `${BASE}/${id}/recalculate`,
        // The proxy route parses the body as JSON, so `{}` — not an empty body.
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 60_000,
          signal,
        }
      );
      // Defensive: if the endpoint ever answers 204 / no envelope, re-read.
      if (!res.data?.data) return await this.getEntry(id, signal);
      return transformEntry(res.data.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },
};
