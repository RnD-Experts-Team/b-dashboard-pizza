import axios from "axios";
import type {
  ApiMaintenanceResponse,
  MaintenanceResponse,
  MaintenanceRequest,
  ApiMaintenanceRequest,
  MaintenanceStatus,
  PaginationInfo,
  PaginationLinks,
  ApiPaginationInfo,
  ApiPaginationLinks,
  ApiMaintenanceRequestDetail,
  ApiMaintenanceUserSummary,
  ApiMaintenancePersonSummary,
  ApiMaintenanceUrgencyLevel,
  ApiMaintenanceAttachment,
  ApiMaintenanceLink,
  ApiMaintenanceStoreSummary,
  ApiMaintenanceStatusHistory,
  MaintenanceRequestDetail,
  MaintenanceUserSummary,
  MaintenancePersonSummary,
  MaintenanceUrgencyLevel,
  MaintenanceAttachment,
  MaintenanceLink,
  MaintenanceStoreSummary,
  MaintenanceStatusHistory,
} from "@/types/maintenance.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type MaintenanceErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class MaintenanceError extends Error {
  readonly code: MaintenanceErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(
    message: string,
    code: MaintenanceErrorCode,
    retryAfter?: number
  ) {
    super(message);
    this.name = "MaintenanceError";
    this.code = code;
    this.retryAfter = retryAfter;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(
      code
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function transformRequest(raw: ApiMaintenanceRequest): MaintenanceRequest {
  return {
    id: raw.id,
    entryNumber: raw.entry_number,
    status: raw.status as MaintenanceStatus,
    brokenItem: raw.broken_item,
    submittedAt: raw.submitted_at,
  };
}

function transformPagination(raw: ApiPaginationInfo): PaginationInfo {
  return {
    currentPage: raw.current_page,
    perPage: raw.per_page,
    total: raw.total,
    lastPage: raw.last_page,
    from: raw.from,
    to: raw.to,
  };
}

function transformLinks(raw: ApiPaginationLinks): PaginationLinks {
  return {
    first: raw.first,
    last: raw.last,
    prev: raw.prev,
    next: raw.next,
  };
}

function transformResponse(raw: ApiMaintenanceResponse): MaintenanceResponse {
  return {
    storeNumber: raw.store_number,
    storeName: raw.store_name,
    ...(raw.pagination && { pagination: transformPagination(raw.pagination) }),
    ...(raw.links && { links: transformLinks(raw.links) }),
    ...(raw.limit != null && { limit: raw.limit }),
    ...(raw.count != null && { count: raw.count }),
    data: raw.data.map(transformRequest),
  };
}

function transformUserSummary(raw: ApiMaintenanceUserSummary): MaintenanceUserSummary {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
  };
}

function transformPersonSummary(raw: ApiMaintenancePersonSummary): MaintenancePersonSummary {
  return {
    id: raw.id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    fullName: raw.full_name,
  };
}

function transformUrgencyLevel(raw: ApiMaintenanceUrgencyLevel): MaintenanceUrgencyLevel {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    priorityOrder: raw.priority_order,
  };
}

function transformAttachment(raw: ApiMaintenanceAttachment): MaintenanceAttachment {
  return {
    id: raw.id,
    contentType: raw.content_type,
    fileName: raw.file_name,
    fileSize: raw.file_size,
    downloadUrl: raw.download_url,
    createdAt: raw.created_at,
  };
}

function transformLink(raw: ApiMaintenanceLink): MaintenanceLink {
  return {
    id: raw.id,
    linkType: raw.link_type,
    downloadUrl: raw.download_url,
    description: raw.description,
    createdAt: raw.created_at,
  };
}

function transformStoreSummary(raw: ApiMaintenanceStoreSummary): MaintenanceStoreSummary {
  return {
    id: raw.id,
    storeNumber: raw.store_number,
    name: raw.name,
    address: raw.address,
  };
}

function transformStatusHistory(raw: ApiMaintenanceStatusHistory): MaintenanceStatusHistory {
  return {
    id: raw.id,
    notes: raw.notes,
    changedAt: raw.changed_at,
    oldStatus: raw.old_status,
    newStatus: raw.new_status,
    changedByUser: raw.changed_by_user
      ? transformUserSummary(raw.changed_by_user)
      : null,
  };
}

function transformRequestDetail(raw: ApiMaintenanceRequestDetail): MaintenanceRequestDetail {
  return {
    id: raw.id,
    storeId: raw.store_id,
    formId: raw.form_id,
    descriptionOfIssue: raw.description_of_issue,
    urgencyLevelId: raw.urgency_level_id,
    equipmentWithIssue: raw.equipment_with_issue,
    basicTroubleshootDone: raw.basic_troubleshoot_done,
    requestDate: raw.request_date,
    dateSubmitted: raw.date_submitted,
    entryNumber: raw.entry_number,
    requesterId: raw.requester_id,
    reviewedByManagerId: raw.reviewed_by_manager_id,
    webhookId: raw.webhook_id,
    notInCognito: raw.not_in_cognito,
    assignmentSource: raw.assignment_source,
    dueDate: raw.due_date,
    taskEndDate: raw.task_end_date,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    status: raw.status,
    reason: raw.reason,
    costs: raw.costs,
    howWeFixedIt: raw.how_we_fixed_it,
    progressDescription: raw.progress_description,
    requester: raw.requester ? transformPersonSummary(raw.requester) : null,
    reviewedByManager: raw.reviewed_by_manager
      ? transformPersonSummary(raw.reviewed_by_manager)
      : null,
    assignedTo: raw.assigned_to ? transformUserSummary(raw.assigned_to) : null,
    urgencyLevel: raw.urgency_level ? transformUrgencyLevel(raw.urgency_level) : null,
    attachments: raw.attachments.map(transformAttachment),
    links: raw.links.map(transformLink),
    store: raw.store ? transformStoreSummary(raw.store) : null,
    statusHistories: raw.status_histories.map(transformStatusHistory),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth helper                                                             */
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

function getSelectedStoreId(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("selected-store-storage");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.selectedStore?.storeId ?? null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const maintenanceService = {
  /**
   * Fetch maintenance requests for a given store through the local API proxy.
   *
   * @param storeId - Store ID (e.g., "03795-00001"). If omitted, uses selected store.
   * @param page    - Page number for pagination (default 1).
   * @param signal  - Optional AbortSignal for cancellation.
   * @param limit   - Optional limit for the number of results per page.
   */
  async getRequests(
    storeId?: string,
    page: number = 1,
    signal?: AbortSignal,
    limit?: number
  ): Promise<MaintenanceResponse> {
    // Resolve store ID
    const resolvedStoreId = storeId || getSelectedStoreId();
    if (!resolvedStoreId) {
      throw new MaintenanceError(
        "No store selected. Please select a store first.",
        "NO_STORE"
      );
    }

    // Resolve token
    const token = getToken();
    if (!token) {
      throw new MaintenanceError(
        "You must be logged in to view maintenance requests.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/maintenance/${encodeURIComponent(resolvedStoreId)}`;

    try {
      const response = await axios.get<ApiMaintenanceResponse>(url, {
        params: { page, ...(limit && { limit }) },
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformResponse(response.data);
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new MaintenanceError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new MaintenanceError(
            serverMessage ||
              "You do not have permission to view maintenance requests for this store.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new MaintenanceError(
            serverMessage ||
              "No maintenance data found for this store.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new MaintenanceError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new MaintenanceError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new MaintenanceError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new MaintenanceError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new MaintenanceError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new MaintenanceError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Fetch a single maintenance request detail by ID.
   */
  async getRequestById(
    requestId: number,
    signal?: AbortSignal
  ): Promise<MaintenanceRequestDetail> {
    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw new MaintenanceError(
        "Invalid maintenance request ID.",
        "NOT_FOUND"
      );
    }

    const token = getToken();
    if (!token) {
      throw new MaintenanceError(
        "You must be logged in to view maintenance request details.",
        "NOT_AUTHENTICATED"
      );
    }

    const resolvedStoreId = getSelectedStoreId();

    const url = `/api/maintenance-requests/${requestId}`;

    try {
      const response = await axios.get<ApiMaintenanceRequestDetail>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(resolvedStoreId && { "X-Store-Id": resolvedStoreId }),
        },
        timeout: 15_000,
        signal,
      });

      return transformRequestDetail(response.data);
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new MaintenanceError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new MaintenanceError(
            serverMessage ||
              "You do not have permission to view this maintenance request.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new MaintenanceError(
            serverMessage || "Maintenance request not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new MaintenanceError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new MaintenanceError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new MaintenanceError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new MaintenanceError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new MaintenanceError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new MaintenanceError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },
};
