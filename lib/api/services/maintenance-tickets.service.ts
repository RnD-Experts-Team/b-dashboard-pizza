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
  FinalNotePayload,
  TicketsFilters,
  ApiTicketsListResponse,
  ApiTicketIssuesResponse,
  ApiTicket,
  ApiTicketIssue,
  ApiTicketAssignment,
  ApiTicketAssignmentDelay,
  ApiTicketIssueStatusChange,
  ApiCatalogIssue,
  ApiCatalogTechnician,
  ApiCatalogPart,
  ApiCatalogCategory,
  EnumField,
  Ticket,
  TicketIssue,
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
  };
}

function transformAssignment(raw: ApiTicketAssignment): TicketAssignment {
  return {
    id: raw.id,
    assignedDate: raw.assigned_date,
    assignedHour: raw.assigned_hour,
    technicians: [], // technicians live at the issue level in the API response
    delays: (raw.delays ?? []).map(transformDelay),
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
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformTicket(raw: ApiTicket): Ticket {
  return {
    id: raw.id,
    storeId: raw.store?.store_number ?? String(raw.store_id),
    status: transformEnumField(raw.status),
    finalNote: raw.final_note,
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
  };
}

function transformCatalogCategory(raw: ApiCatalogCategory): CatalogCategory {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
  };
}

function transformCatalogPart(raw: ApiCatalogPart): CatalogPart {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    deletedAt: raw.deleted_at,
  };
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
    const params: Record<string, string | number> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.priority) params.priority = filters.priority;
    if (filters?.created_from) params.created_from = filters.created_from;
    if (filters?.created_to) params.created_to = filters.created_to;
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

  /** Set (or clear) the final note on a completed ticket */
  async setFinalNote(
    storeId: string,
    ticketId: number,
    payload: FinalNotePayload
  ): Promise<void> {
    const token = requireToken();
    try {
      await axios.post(
        `/api/maintenance-tickets/stores/${encodeURIComponent(storeId)}/tickets/${ticketId}/final-note`,
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
