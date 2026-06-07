import axios from "axios";
import type {
  TicketsListResponse,
  TicketIssuesResponse,
  CatalogIssue,
  CatalogTechnician,
  CatalogCategory,
  CatalogPart,
  CreateTicketPayload,
  AssignIssuesPayload,
  StatusChangePayload,
  DeferPayload,
  CancelPayload,
  FinalNotePayload,
  CreateNotePayload,
  CreateDiagnosisPayload,
  CreateAttendanceEntryPayload,
  CreatePartUsagePayload,
  CreatePayEntryPayload,
  CreateWarrantyPayload,
  AttachTechniciansPayload,
  DelayAssignmentPayload,
  ChangeAssignmentTechniciansPayload,
  TicketsFilters,
  ApiTicketsListResponse,
  ApiTicketIssuesResponse,
  ApiTicket,
  ApiTicketIssue,
  ApiTicketAssignment,
  ApiTicketAssignmentDelay,
  ApiTicketIssueStatusChange,
  ApiTicketAttachment,
  ApiTicketIssueDiagnosis,
  ApiTicketIssueAttendance,
  ApiTicketIssuePartUsage,
  ApiTicketIssuePayEntry,
  ApiTicketIssueWarranty,
  ApiTicketNote,
  TicketNote,
  ApiCatalogIssue,
  ApiCatalogTechnician,
  ApiCatalogPart,
  ApiCatalogCategory,
  EnumField,
  Ticket,
  TicketIssue,
  TicketAttachment,
  TicketIssueDiagnosis,
  TicketIssueAttendance,
  TicketIssuePartUsage,
  TicketIssuePayEntry,
  TicketIssueWarranty,
  TicketAssignment,
  TicketAssignmentDelay,
  TicketIssueStatusChange,
  LaravelPaginationMeta,
  LaravelPaginationLinks,
} from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type TicketsErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class MaintenanceTicketsError extends Error {
  readonly code: TicketsErrorCode;
  readonly retryable: boolean;
  readonly validationErrors?: Record<string, string[]>;

  constructor(
    message: string,
    code: TicketsErrorCode,
    validationErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "MaintenanceTicketsError";
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
        data?.errors
      );
    }
    if (status === 429) throw new MaintenanceTicketsError("Too many requests.", "RATE_LIMITED");
    if (status != null && status >= 500) {
      throw new MaintenanceTicketsError("Server error. Please try again.", "SERVER_ERROR");
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

function transformDelay(raw: ApiTicketAssignmentDelay): TicketAssignmentDelay {
  return {
    id: raw.id,
    assignmentId: raw.assignment_id,
    newDate: raw.new_date,
    newHour: raw.new_hour,
    reason: raw.reason,
    createdAt: raw.created_at,
  };
}

function transformTechnician(raw: ApiCatalogTechnician): CatalogTechnician {
  return {
    id: raw.id,
    name: raw.name,
    phone: raw.phone ?? null,
    categoryId: raw.category_id,
    categoryName: raw.category?.name ?? null,
    deletedAt: raw.deleted_at ?? null,
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
  };
}

function transformAssignment(raw: ApiTicketAssignment): TicketAssignment {
  return {
    id: raw.id,
    assignedDate: raw.assigned_date,
    assignedHour: raw.assigned_hour,
    technicians: [], // technicians live at the issue level in the API response
    delays: (raw.delays ?? []).map(transformDelay),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    createdAt: raw.created_at,
  };
}

function transformStatusChange(raw: ApiTicketIssueStatusChange): TicketIssueStatusChange {
  // API returns raw status strings; build a display-friendly EnumField from to_status
  const label = raw.to_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: raw.id,
    status: { value: raw.to_status, label },
    changedBy: raw.created_by != null ? String(raw.created_by) : null,
    reason: raw.reason,
    createdAt: raw.created_at,
  };
}

function transformIssue(raw: ApiTicketIssue): TicketIssue {
  return {
    id: raw.id,
    ticketId: raw.ticket_id,
    issueId: raw.issue_id,
    issueTitle: raw.display_title ?? raw.issue?.title ?? null,
    otherTitle: raw.other_title,
    priority: transformEnumField(raw.priority),
    status: transformEnumField(raw.status),
    description: raw.description,
    parentId: raw.parent_id,
    assignments: (raw.assignments ?? []).map(transformAssignment),
    statusChanges: (raw.status_changes ?? []).map(transformStatusChange),
    technicians: (raw.technicians ?? []).map(transformTechnician),
    children: (raw.children ?? []).map(transformIssue),
    diagnoses: (raw.diagnoses ?? []).map(transformDiagnosis),
    attendanceEntries: (raw.attendance_entries ?? []).map(transformAttendance),
    partUsages: (raw.part_usages ?? []).map(transformPartUsage),
    payEntries: (raw.pay_entries ?? []).map(transformPayEntry),
    warranties: (raw.warranties ?? []).map(transformWarranty),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    createdBy: raw.created_by ?? null,
    creator: raw.creator ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformTicket(raw: ApiTicket): Ticket {
  return {
    id: raw.id,
    storeId: raw.store?.store_number ?? String(raw.store_id),
    status: transformEnumField(raw.status),
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    creator: raw.creator ?? null,
    issueCount: raw.issues_count ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    deletedAt: raw.deleted_at,
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

function transformCatalogIssue(raw: ApiCatalogIssue): CatalogIssue {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    deletedAt: raw.deleted_at,
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
  };
}

function transformCatalogCategory(raw: ApiCatalogCategory): CatalogCategory {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
  };
}

function transformCatalogPart(raw: ApiCatalogPart): CatalogPart {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    deletedAt: raw.deleted_at,
    notes: (raw.notes ?? []).map(transformNote),
    attachments: (raw.attachments ?? []).map(transformAttachment),
  };
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Lifecycle record transform helpers                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function transformAttachment(raw: ApiTicketAttachment): TicketAttachment {
  const fileName = raw.file_name ?? raw.original_name ?? raw.path ?? `attachment-${raw.id}`;
  const fileSize = raw.file_size ?? raw.size ?? null;
  const contentType = raw.content_type ?? raw.mime_type ?? null;

  return {
    id: raw.id,
    fileName,
    fileSize,
    contentType,
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
    creator: raw.creator ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformDiagnosis(raw: ApiTicketIssueDiagnosis): TicketIssueDiagnosis {
  return {
    id: raw.id,
    ticketIssueId: raw.ticket_issue_id,
    body: raw.body,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    mistaken: raw.mistaken,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function transformAttendance(raw: ApiTicketIssueAttendance): TicketIssueAttendance {
  return {
    id: raw.id,
    ticketIssueId: raw.ticket_issue_id,
    technicianId: raw.technician_id,
    technician: raw.technician ? { id: raw.technician.id, name: raw.technician.name } : null,
    startClock: raw.start_clock,
    endClock: raw.end_clock,
    startBreak: raw.start_break,
    endBreak: raw.end_break,
    startPartsRun: raw.start_parts_run,
    endPartsRun: raw.end_parts_run,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    mistaken: raw.mistaken,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function transformPartUsage(raw: ApiTicketIssuePartUsage): TicketIssuePartUsage {
  return {
    id: raw.id,
    ticketIssueId: raw.ticket_issue_id,
    partId: raw.part_id,
    part: raw.part ? { id: raw.part.id, name: raw.part.name } : null,
    cost: parseFloat(raw.cost),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    mistaken: raw.mistaken,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function parseDecimal(value: string | null): number | null {
  return value != null ? parseFloat(value) : null;
}

function transformPayEntry(raw: ApiTicketIssuePayEntry): TicketIssuePayEntry {
  return {
    id: raw.id,
    ticketIssueId: raw.ticket_issue_id,
    technicianId: raw.technician_id,
    technician: raw.technician ? { id: raw.technician.id, name: raw.technician.name } : null,
    basePay: parseDecimal(raw.base_pay),
    performancePay: parseDecimal(raw.performance_pay),
    drivingBasePay: parseDecimal(raw.driving_base_pay),
    drivingPerformancePay: parseDecimal(raw.driving_performance_pay),
    drivingTime: parseDecimal(raw.driving_time),
    milesDriven: parseDecimal(raw.miles_driven),
    perMileRate: parseDecimal(raw.per_mile_rate),
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    mistaken: raw.mistaken,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

function transformWarranty(raw: ApiTicketIssueWarranty): TicketIssueWarranty {
  return {
    id: raw.id,
    ticketIssueId: raw.ticket_issue_id,
    body: raw.body,
    expiryDate: raw.expiry_date ?? null,
    attachments: (raw.attachments ?? []).map(transformAttachment),
    notes: (raw.notes ?? []).map(transformNote),
    mistaken: raw.mistaken,
    createdBy: raw.created_by ?? null,
    createdAt: raw.created_at,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Entity path builders (for generic addNote / addAttachments)             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Builds the relative entity path passed to `addNote` / `addAttachments`.
 * Each value is the path WITHOUT the `/notes` or `/attachments` suffix.
 */
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
} as const;

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
    const params: Record<string, string | number> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.priority) params.priority = filters.priority;
    if (filters?.issue_id) params.issue_id = filters.issue_id;
    if (filters?.issue_status) params.issue_status = filters.issue_status;
    if (filters?.part_cost_total_gt != null) params.part_cost_total_gt = filters.part_cost_total_gt;
    if (filters?.technician_id) params.technician_id = filters.technician_id;
    if (filters?.trashed) params.trashed = filters.trashed;
    if (filters?.page) params.page = filters.page;
    if (filters?.per_page) params.per_page = filters.per_page;

    try {
      const res = await axios.get<ApiTicketsListResponse>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets`,
        {
          params,
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return {
        data: res.data.data.map(transformTicket),
        links: transformLinks(res.data),
        meta: transformMeta(res.data),
      };
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
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
      return { data: transformTicket(res.data.data) };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Get all issues (with full history) for a ticket */
  async getTicketIssues(
    storeId: string,
    ticketId: number,
    signal?: AbortSignal
  ): Promise<TicketIssuesResponse> {
    const token = requireToken();
    try {
      const res = await axios.get<ApiTicketIssuesResponse>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/issues`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return { data: res.data.data.map(transformIssue) };
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Assign issues to technicians with a date */
  async assignIssues(
    storeId: string,
    ticketId: number,
    payload: AssignIssuesPayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/assignments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Bulk change status of one or more ticket issues */
  async changeIssueStatus(
    storeId: string,
    ticketId: number,
    payload: StatusChangePayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/issues/status`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Defer an issue (creates a new pending child) */
  async deferIssue(
    storeId: string,
    ticketId: number,
    issueId: number,
    payload: DeferPayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/issues/${issueId}/defer`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Cancel an issue (terminal; reason required; no child spawned) */
  async cancelIssue(
    storeId: string,
    ticketId: number,
    issueId: number,
    payload: CancelPayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/issues/${issueId}/cancel`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Append a typed closing note to a ticket (multipart; supports files).
   * Returns the refreshed ticket including all notes.
   */
  async addFinalNote(
    storeId: string,
    ticketId: number,
    payload: FinalNotePayload,
    files?: File[]
  ): Promise<Ticket> {
    const token = requireToken();
    const body = buildFormData(payload, files);
    try {
      const res = await axios.post<{ data: ApiTicket }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/final-note`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
      );
      return transformTicket(res.data.data);
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
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
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
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
      );
      return (res.data.data ?? []).map(transformAttachment);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Load catalog issues (for dropdowns) */
  async getCatalogIssues(signal?: AbortSignal): Promise<CatalogIssue[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiCatalogIssue[] }>(
        "/api/maintenance-tickets/catalog/issues",
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return (res.data.data ?? []).map(transformCatalogIssue);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Load catalog technicians (for dropdowns) */
  async getCatalogTechnicians(signal?: AbortSignal): Promise<CatalogTechnician[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiCatalogTechnician[] }>(
        "/api/maintenance-tickets/catalog/technicians",
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return (res.data.data ?? []).map(transformTechnician);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Load all catalog categories */
  async getCatalogCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiCatalogCategory[] }>(
        "/api/maintenance-tickets/catalog/categories",
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return (res.data.data ?? res.data as unknown as ApiCatalogCategory[]).map(transformCatalogCategory);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /** Load all catalog parts */
  async getCatalogParts(signal?: AbortSignal): Promise<CatalogPart[]> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiCatalogPart[] }>(
        "/api/maintenance-tickets/catalog/parts",
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return (res.data.data ?? []).map(transformCatalogPart);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /* ── Catalog CRUD ─────────────────────────────────────────────────────── */

  async createCatalogIssue(payload: { title: string; description?: string }): Promise<CatalogIssue> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiCatalogIssue }>(
        "/api/maintenance-tickets/catalog/issues",
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
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

  async createCatalogTechnician(payload: { name: string; phone?: string; category_id?: number }): Promise<CatalogTechnician> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiCatalogTechnician }>(
        "/api/maintenance-tickets/catalog/technicians",
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformTechnician(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  async deleteCatalogTechnician(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/catalog/technicians/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  async restoreCatalogTechnician(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(`/api/maintenance-tickets/catalog/technicians/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  async createCatalogCategory(payload: { name: string; description?: string }): Promise<CatalogCategory> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiCatalogCategory }>(
        "/api/maintenance-tickets/catalog/categories",
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformCatalogCategory(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  async deleteCatalogCategory(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/catalog/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  async createCatalogPart(payload: { name: string; description?: string }): Promise<CatalogPart> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiCatalogPart }>(
        "/api/maintenance-tickets/catalog/parts",
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformCatalogPart(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  async deleteCatalogPart(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.delete(`/api/maintenance-tickets/catalog/parts/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
  },

  async restoreCatalogPart(id: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(`/api/maintenance-tickets/catalog/parts/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000,
      });
    } catch (err) { return handleAxiosError(err); }
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
    const params: Record<string, string | number> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.priority) params.priority = filters.priority;
    if (filters?.issue_id) params.issue_id = filters.issue_id;
    if (filters?.issue_status) params.issue_status = filters.issue_status;
    if (filters?.part_cost_total_gt != null) params.part_cost_total_gt = filters.part_cost_total_gt;
    if (filters?.technician_id) params.technician_id = filters.technician_id;
    if (filters?.trashed) params.trashed = filters.trashed;
    if (filters?.page) params.page = filters.page;
    if (filters?.per_page) params.per_page = filters.per_page;
    try {
      const res = await axios.get<ApiTicketsListResponse>(
        "/api/maintenance-tickets/tickets",
        { params, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return {
        data: res.data.data.map(transformTicket),
        links: transformLinks(res.data),
        meta: transformMeta(res.data),
      };
    } catch (err) { return handleAxiosError(err); }
  },

  /** Get a single ticket issue with its full history */
  async getSingleIssue(storeId: string, ticketId: number, issueId: number, signal?: AbortSignal): Promise<TicketIssue> {
    const token = requireToken();
    try {
      const res = await axios.get<{ data: ApiTicketIssue }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/issues/${issueId}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000, signal }
      );
      return transformIssue(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Assignment mutations ──────────────────────────────────────────────── */

  /** Attach technicians to one or more issues (without scheduling a date) */
  async attachTechnicians(storeId: string, ticketId: number, payload: AttachTechniciansPayload): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/technicians`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /** Add a delay record to an existing assignment (reschedule with history) */
  async delayAssignment(
    storeId: string,
    ticketId: number,
    assignmentId: number,
    payload: DelayAssignmentPayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/assignments/${assignmentId}/delays`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /** Replace the technician list on an existing assignment */
  async changeAssignmentTechnicians(
    storeId: string,
    ticketId: number,
    assignmentId: number,
    payload: ChangeAssignmentTechniciansPayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/assignments/${assignmentId}/change-technicians`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Diagnoses ─────────────────────────────────────────────────────────── */

  /** Add a diagnosis to one or more ticket issues (optionally with attachments) */
  async createDiagnosis(
    storeId: string,
    ticketId: number,
    payload: CreateDiagnosisPayload,
    files?: File[]
  ): Promise<TicketIssueDiagnosis> {
    const token = requireToken();
    const body = buildFormData(payload, files);
    try {
      const res = await axios.post<{ data: ApiTicketIssueDiagnosis }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/diagnoses`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
      );
      return transformDiagnosis(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Mark a diagnosis as mistaken (retains record; excluded from rollups) */
  async markDiagnosisMistaken(storeId: string, ticketId: number, diagnosisId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/diagnoses/${diagnosisId}/mistaken`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Attendance entries ────────────────────────────────────────────────── */

  /** Add an attendance/time entry to one or more ticket issues */
  async createAttendanceEntry(
    storeId: string,
    ticketId: number,
    payload: CreateAttendanceEntryPayload,
    files?: File[]
  ): Promise<TicketIssueAttendance> {
    const token = requireToken();
    const body = files?.length ? buildFormData(payload, files) : payload;
    try {
      const res = await axios.post<{ data: ApiTicketIssueAttendance }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/attendance-entries`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(!files?.length ? { "Content-Type": "application/json" } : {}) }, timeout: 30_000 }
      );
      return transformAttendance(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Mark an attendance entry as mistaken */
  async markAttendanceMistaken(storeId: string, ticketId: number, attendanceId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/attendance-entries/${attendanceId}/mistaken`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Part usages ───────────────────────────────────────────────────────── */

  /** Add a part-usage record to one or more ticket issues */
  async createPartUsage(
    storeId: string,
    ticketId: number,
    payload: CreatePartUsagePayload,
    files?: File[]
  ): Promise<TicketIssuePartUsage> {
    const token = requireToken();
    const body = buildFormData(payload, files);
    try {
      const res = await axios.post<{ data: ApiTicketIssuePartUsage }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/part-usages`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
      );
      return transformPartUsage(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Mark a part-usage record as mistaken (cost excluded from rollups) */
  async markPartUsageMistaken(storeId: string, ticketId: number, partUsageId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/part-usages/${partUsageId}/mistaken`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Pay entries ───────────────────────────────────────────────────────── */

  /** Add a pay entry for a technician to one or more ticket issues */
  async createPayEntry(
    storeId: string,
    ticketId: number,
    payload: CreatePayEntryPayload
  ): Promise<TicketIssuePayEntry> {
    const token = requireToken();
    try {
      const res = await axios.post<{ data: ApiTicketIssuePayEntry }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/pay-entries`,
        payload,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" }, timeout: 15_000 }
      );
      return transformPayEntry(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Mark a pay entry as mistaken */
  async markPayEntryMistaken(storeId: string, ticketId: number, payEntryId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/pay-entries/${payEntryId}/mistaken`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

  /* ── Warranties ────────────────────────────────────────────────────────── */

  /** Add a warranty record to one or more ticket issues */
  async createWarranty(
    storeId: string,
    ticketId: number,
    payload: CreateWarrantyPayload,
    files?: File[]
  ): Promise<TicketIssueWarranty> {
    const token = requireToken();
    const body = buildFormData(payload, files);
    try {
      const res = await axios.post<{ data: ApiTicketIssueWarranty }>(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/warranties`,
        body,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 30_000 }
      );
      return transformWarranty(res.data.data);
    } catch (err) { return handleAxiosError(err); }
  },

  /** Mark a warranty as mistaken */
  async markWarrantyMistaken(storeId: string, ticketId: number, warrantyId: number): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/warranties/${warrantyId}/mistaken`,
        {},
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15_000 }
      );
    } catch (err) { return handleAxiosError(err); }
  },

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
