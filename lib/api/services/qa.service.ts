import axios from "axios";
import type {
  ApiQAAuditsResponse,
  ApiQARatingsSummaryResponse,
  QAAuditsResponse,
  QAAudit,
  QARatingsSummaryItem,
  ApiQAAudit,
  QAStore,
  ApiQAStore,
  QAUser,
  ApiQAUser,
  ApiQACategoryCreateResponse,
  QACategory,
  CreateQACategoryPayload,
  UpdateQACategoryPayload,
  ApiQAEntityCreateResponse,
  QAEntity,
  CreateQAEntityPayload,
  UpdateQAEntityPayload,
  ApiQAEntitiesListResponse,
  QAEntityListCategory,
  QAEntitiesAndCategories,
  ApiCameraReportResponse,
  CameraReportData,
  CameraReportSummaryItem,
  CameraReportEntity,
  CameraReportCategory,
  CameraReportEntityDef,
  CameraReportScoreData,
  ApiCameraReportSummaryItem,
  ApiCameraReportEntity,
  ApiCameraReportCategory,
  ApiCameraReportEntityDef,
  CameraFormEntityEntry,
  CameraFormUpdateEntityEntry,
  ApiCameraFormCreateResponse,
  ApiCameraFormsListResponse,
  CameraFormsListResponse,
  CameraFormAudit,
  CameraFormEntryItem,
  CameraFormNote,
  CameraFormAttachment,
  CameraFormsFilterParams,
  ApiCameraFormAudit,
  ApiCameraFormEntry,
} from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type QAErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

export class QAError extends Error {
  readonly code: QAErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(message: string, code: QAErrorCode, retryAfter?: number) {
    super(message);
    this.name = "QAError";
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

function transformStore(raw: ApiQAStore): QAStore {
  return {
    id: raw.id,
    store: raw.store,
    group: raw.group,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformUser(raw: ApiQAUser): QAUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformAudit(raw: ApiQAAudit): QAAudit {
  return {
    id: raw.id,
    storeId: raw.store_id,
    userId: raw.user_id,
    date: raw.date,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    store: transformStore(raw.store),
    user: transformUser(raw.user),
  };
}

function transformResponse(raw: ApiQAAuditsResponse): QAAuditsResponse {
  return {
    audits: raw.data.data.map(transformAudit),
    pagination: {
      currentPage: raw.data.current_page,
      perPage: raw.data.per_page,
      total: raw.data.total,
      lastPage: raw.data.last_page,
      from: raw.data.from,
      to: raw.data.to,
    },
    hasNextPage: raw.data.next_page_url !== null,
    hasPrevPage: raw.data.prev_page_url !== null,
  };
}

function transformRatingsSummaryResponse(
  raw: ApiQARatingsSummaryResponse
): QARatingsSummaryItem[] {
  return (raw.data ?? []).map((item) => ({
    entityId: item.entity_id,
    entityLabel: item.entity_label,
    autoFailCount: item.auto_fail_count,
    urgentCount: item.urgent_count,
    totalCount: item.total_count,
  }));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Camera Forms List transform helpers                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function transformCameraFormAudit(raw: ApiCameraFormAudit): CameraFormAudit {
  return {
    id: raw.id,
    storeId: raw.store_id,
    userId: raw.user_id,
    date: raw.date,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    store: {
      id: raw.store?.id ?? raw.store_id,
      store: raw.store?.store ?? "Unknown Store",
      group: raw.store?.group ?? 0,
    },
    user: {
      id: raw.user?.id ?? raw.user_id,
      name: raw.user?.name ?? "Unknown User",
      email: raw.user?.email ?? "",
    },
    cameraForms: (raw.camera_forms ?? []).map(
      (cf: ApiCameraFormEntry): CameraFormEntryItem => ({
        id: cf.id,
        userId: cf.user_id,
        entityId: cf.entity_id,
        auditId: cf.audit_id,
        ratingId: cf.rating_id,
        entity: {
          id: cf.entity?.id ?? cf.entity_id,
          entityLabel:
            cf.entity?.entity_label ?? `Entity ${cf.entity_id ?? "Unknown"}`,
          category: {
            id: cf.entity?.category?.id ?? 0,
            label: cf.entity?.category?.label ?? "Unknown",
            sortOrder: cf.entity?.category?.sort_order ?? 0,
          },
        },
        rating: {
          id: cf.rating?.id ?? cf.rating_id,
          label: cf.rating?.label ?? "Unknown",
        },
        notes: (cf.notes ?? []).map(
          (n): CameraFormNote => ({
            id: n.id,
            cameraFormId: n.camera_form_id,
            note: n.note,
            attachments: (n.attachments ?? []).map(
              (a): CameraFormAttachment => ({
                id: a.id,
                cameraFormNoteId: a.camera_form_note_id,
                path: a.path,
                url: a.url,
              })
            ),
          })
        ),
      })
    ),
  };
}

function transformCameraFormsListResponse(
  raw: ApiCameraFormsListResponse
): CameraFormsListResponse {
  const data = raw.data;
  return {
    audits: (data.data ?? []).map(transformCameraFormAudit),
    pagination: {
      currentPage: data.current_page,
      perPage: data.per_page,
      total: data.total,
      lastPage: data.last_page ?? (Math.ceil(data.total / data.per_page) || 1),
      from: data.from ?? null,
      to: data.to ?? null,
    },
    hasNextPage: data.next_page_url !== null && data.next_page_url !== undefined,
    hasPrevPage:
      data.prev_page_url !== null && data.prev_page_url !== undefined,
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

const EXPORT_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const qaService = {
  /**
   * Fetch QA audits through the local API proxy.
   *
   * @param page   - Page number for pagination (default 1).
   * @param signal - Optional AbortSignal for cancellation.
   */
  async getAudits(
    page: number = 1,
    signal?: AbortSignal
  ): Promise<QAAuditsResponse> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view QA audits.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/audits`;

    try {
      const response = await axios.get<ApiQAAuditsResponse>(url, {
        params: { page },
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage ||
              "You do not have permission to view QA audits.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "No QA audits found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Fetch top QA ratings summary for a store and date range.
   */
  async getRatingsSummary(
    storeId: string,
    dateStart: string,
    dateEnd: string,
    signal?: AbortSignal
  ): Promise<QARatingsSummaryItem[]> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view QA ratings summary.",
        "NOT_AUTHENTICATED"
      );
    }

    const encodedStoreId = encodeURIComponent(storeId);
    const url = `/api/qa/audits/ratings-summary/${encodedStoreId}/${dateStart}/${dateEnd}`;

    try {
      const response = await axios.get<ApiQARatingsSummaryResponse>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformRatingsSummaryResponse(response.data);
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage ||
              "You do not have permission to view QA ratings summary.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "QA ratings summary not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Fetch QA entities (and categories) through the local API proxy.
   */
  async getEntities(signal?: AbortSignal): Promise<QAEntityListCategory[]> {
    const full = await this.getEntitiesAndCategories(signal);
    return full.categories;
  },

  /**
   * Fetch both QA entities and categories through the local API proxy.
   */
  async getEntitiesAndCategories(signal?: AbortSignal): Promise<QAEntitiesAndCategories> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view QA entities.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/entities`;

    try {
      const response = await axios.get<ApiQAEntitiesListResponse>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      const categoriesMap = new Map<number, string>();
      for (const cat of response.data.data.categories ?? []) {
        categoriesMap.set(cat.id, cat.label);
      }

      const entities = (response.data.data.entities ?? []).map((e) => ({
        id: e.id,
        entityLabel: e.entity_label,
        categoryId: e.category_id,
        dateRangeType: e.date_range_type,
        reportType: e.report_type,
        sortOrder: e.sort_order,
        active: e.active,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        categoryLabel: e.category?.label ?? categoriesMap.get(e.category_id),
      }));

      const categories = (response.data.data.categories ?? []).map((cat) => ({
        id: cat.id,
        label: cat.label,
        sortOrder: cat.sort_order,
        entitiesCount: cat.entities_count ?? 0,
        createdAt: cat.created_at,
        updatedAt: cat.updated_at,
      }));

      return { entities, categories };
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to view entities.",
            "FORBIDDEN"
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Create a new QA category through the local API proxy.
   */
  async createCategory(payload: CreateQACategoryPayload): Promise<QACategory> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to create QA categories.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/categories`;

    try {
      const response = await axios.post<ApiQACategoryCreateResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });

      const raw = response.data.data;
      return {
        id: raw.id,
        label: raw.label,
        sortOrder: raw.sort_order,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to create categories.",
            "FORBIDDEN"
          );
        }
        if (status === 422 || serverCode === "VALIDATION_ERROR") {
          throw new QAError(
            serverMessage || "Validation failed. Please check your input.",
            "SERVER_ERROR"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Update an existing QA category through the local API proxy.
   *
   * @param id      - Category ID to update.
   * @param payload - Fields to update (label, sort_order).
   */
  async updateCategory(id: number, payload: UpdateQACategoryPayload): Promise<QACategory> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to update QA categories.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/categories/${id}`;

    try {
      const response = await axios.put<ApiQACategoryCreateResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });

      const raw = response.data.data;
      return {
        id: raw.id,
        label: raw.label,
        sortOrder: raw.sort_order,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to update categories.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Category not found.",
            "NOT_FOUND"
          );
        }
        if (status === 422 || serverCode === "VALIDATION_ERROR") {
          throw new QAError(
            serverMessage || "Validation failed. Please check your input.",
            "SERVER_ERROR"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Delete a QA category through the local API proxy.
   *
   * @param id - Category ID to delete.
   */
  async deleteCategory(id: number): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to delete QA categories.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/categories/${id}`;

    try {
      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
      });
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to delete categories.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Category not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Create a new QA entity through the local API proxy.
   */
  async createEntity(payload: CreateQAEntityPayload): Promise<QAEntity> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to create QA entities.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/entities`;

    try {
      const response = await axios.post<ApiQAEntityCreateResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });

      const raw = response.data.data;
      return {
        id: raw.id,
        entityLabel: raw.entity_label,
        categoryId: raw.category_id,
        dateRangeType: raw.date_range_type,
        reportType: raw.report_type,
        sortOrder: raw.sort_order,
        active: raw.active,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to create entities.",
            "FORBIDDEN"
          );
        }
        if (status === 422 || serverCode === "VALIDATION_ERROR") {
          throw new QAError(
            serverMessage || "Validation failed. Please check your input.",
            "SERVER_ERROR"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Update an existing QA entity through the local API proxy.
   *
   * @param id      - Entity ID to update.
   * @param payload - Fields to update.
   */
  async updateEntity(id: number, payload: UpdateQAEntityPayload): Promise<QAEntity> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to update QA entities.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/entities/${id}`;

    try {
      const response = await axios.put<ApiQAEntityCreateResponse>(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });

      const raw = response.data.data;
      return {
        id: raw.id,
        entityLabel: raw.entity_label,
        categoryId: raw.category_id,
        dateRangeType: raw.date_range_type,
        reportType: raw.report_type,
        sortOrder: raw.sort_order,
        active: raw.active,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      };
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to update entities.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Entity not found.",
            "NOT_FOUND"
          );
        }
        if (status === 422 || serverCode === "VALIDATION_ERROR") {
          throw new QAError(
            serverMessage || "Validation failed. Please check your input.",
            "SERVER_ERROR"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Delete a QA entity through the local API proxy.
   *
   * @param id - Entity ID to delete.
   */
  async deleteEntity(id: number): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to delete QA entities.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/entities/${id}`;

    try {
      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
      });
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to delete entities.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Entity not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Fetch camera report through the local API proxy.
   *
   * @param params - Optional filter parameters.
   * @param signal - Optional AbortSignal for cancellation.
   */
  async getCameraReport(
    params?: {
      store_id?: number;
      group?: number;
      report_type?: string;
      date_from?: string;
      date_to?: string;
      rating_id?: number;
    },
    signal?: AbortSignal
  ): Promise<CameraReportData> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view camera reports.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-reports`;

    try {
      const response = await axios.get<ApiCameraReportResponse>(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformCameraReportResponse(response.data);
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage ||
              "You do not have permission to view camera reports.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Camera reports not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Export camera report through the local API proxy.
   * Triggers a file download in the browser.
   *
   * @param params - Optional filter parameters.
   */
  async exportCameraReport(params?: {
    store_id?: number;
    group?: number;
    report_type?: string;
    date_from?: string;
    date_to?: string;
    rating_id?: number;
  }): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to export camera reports.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-reports/export`;

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        timeout: EXPORT_DOWNLOAD_TIMEOUT_MS,
      });

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers["content-disposition"];
      let filename = "camera-report-export.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      }

      // Trigger download
      const blob = response.data as Blob;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        if (status === 401) {
          throw new QAError("Authentication failed.", "UNAUTHORIZED");
        }
        if (status === 403) {
          throw new QAError(
            "You do not have permission to export camera reports.",
            "FORBIDDEN"
          );
        }
        if (status === 429) {
          throw new QAError(
            "Too many requests. Please wait and try again.",
            "RATE_LIMITED"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Export camera report to Excel through the local API proxy.
   * Triggers a file download in the browser.
   *
   * @param params - Optional filter parameters.
   */
  async exportCameraReportExcel(params?: {
    store_id?: number;
    group?: number;
    report_type?: string;
    date_from?: string;
    date_to?: string;
    rating_id?: number;
  }): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to export camera reports.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-reports/exportExcel`;

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        timeout: EXPORT_DOWNLOAD_TIMEOUT_MS,
      });

      const contentDisposition = response.headers["content-disposition"];
      let filename = "camera-report-export.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      }

      const blob = response.data as Blob;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) throw new QAError("Authentication failed.", "UNAUTHORIZED");
        if (status === 403) throw new QAError("Permission denied.", "FORBIDDEN");
        if (status === 404) throw new QAError("Export endpoint not found.", "NOT_FOUND");
        if (status === 429) throw new QAError("Rate limit exceeded.", "RATE_LIMITED", 30);
        throw new QAError(`Server error: ${status || "Unknown"}`, "SERVER_ERROR");
      }
      throw new QAError(err instanceof Error ? err.message : "Network or parsing error.", "NETWORK_ERROR");
    }
  },

  /**
   * Export camera report images through the local API proxy.
   * Triggers a file download in the browser.
   *
   * @param params - Optional filter parameters.
   */
  async exportCameraReportImages(params?: {
    store_id?: number;
    group?: number;
    report_type?: string;
    date_from?: string;
    date_to?: string;
    rating_id?: number;
  }): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to export camera reports.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-reports/exportImages`;

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
        timeout: EXPORT_DOWNLOAD_TIMEOUT_MS,
      });

      const contentDisposition = response.headers["content-disposition"];
      let filename = "camera-report-images.zip";
      if (contentDisposition) {
        const match = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (match?.[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      }

      const blob = response.data as Blob;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) throw new QAError("Authentication failed.", "UNAUTHORIZED");
        if (status === 403) throw new QAError("Permission denied.", "FORBIDDEN");
        if (status === 404) throw new QAError("Export endpoint not found.", "NOT_FOUND");
        if (status === 429) throw new QAError("Rate limit exceeded.", "RATE_LIMITED", 30);
        throw new QAError(`Server error: ${status || "Unknown"}`, "SERVER_ERROR");
      }
      throw new QAError(err instanceof Error ? err.message : "Network or parsing error.", "NETWORK_ERROR");
    }
  },

  /**
   * Fetch camera forms list through the local API proxy.
   *
   * @param filters - Filter/pagination parameters.
   * @param signal  - Optional AbortSignal for cancellation.
   */
  async getCameraForms(
    filters: CameraFormsFilterParams = {},
    signal?: AbortSignal
  ): Promise<CameraFormsListResponse> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view camera forms.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-forms`;
    const params: Record<string, string | number> = {};

    if (filters.page && filters.page >= 1) params.page = filters.page;
    if (filters.dateRangeType)
      params.date_range_type = filters.dateRangeType;
    if (filters.dateFrom) params.date_from = filters.dateFrom;
    if (filters.dateTo) params.date_to = filters.dateTo;
    if (filters.storeId) params.store_id = filters.storeId;

    try {
      const response = await axios.get<ApiCameraFormsListResponse>(url, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformCameraFormsListResponse(response.data);
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage ||
              "You do not have permission to view camera forms.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Camera forms not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage ||
              "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Fetch a single camera form audit by ID through the local API proxy.
   */
  async getCameraFormById(
    id: number,
    signal?: AbortSignal
  ): Promise<CameraFormAudit> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to view camera forms.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-forms/${id}`;

    try {
      const response = await axios.get<{
        status: string;
        message: string;
        data: ApiCameraFormAudit;
        errors: unknown;
      }>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformCameraFormAudit(response.data.data);
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
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage ||
              "You do not have permission to view camera forms.",
            "FORBIDDEN"
          );
        }
        if (status === 404 || serverCode === "NOT_FOUND") {
          throw new QAError(
            serverMessage || "Camera form not found.",
            "NOT_FOUND"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage ||
              "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Create a camera form (audit) through the local API proxy.
   *
   * @param storeId  - Store ID (integer).
   * @param date     - Date in YYYY-MM-DD format.
   * @param entities - Array of entity rating entries (with optional note & attachments).
   */
  async createCameraForm(
    storeId: number,
    date: string,
    entities: CameraFormEntityEntry[]
  ): Promise<ApiCameraFormCreateResponse> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to create camera forms.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-forms`;

    // Build form data: Laravel expects indexed array notation
    // e.g., entities[0][entity_id], entities[0][rating_id], 
    //       entities[0][notes][0][note], entities[0][notes][0][images][]
    const formData = new FormData();
    formData.append("store_id", String(storeId));
    formData.append("date", date);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Required fields for each entity
      formData.append(`entities[${i}][entity_id]`, String(entity.entity_id));
      if (entity.rating_id != null) {
        formData.append(`entities[${i}][rating_id]`, String(entity.rating_id));
      }

      // Optional note and attachments
      if (entity.note?.trim() || (entity.attachments && entity.attachments.length > 0)) {
        // If we have a note, add it to notes[0][note]
        if (entity.note?.trim()) {
          formData.append(`entities[${i}][notes][0][note]`, entity.note.trim());
        }
        
        // If we have attachments, add them to notes[0][images][]
        if (entity.attachments && entity.attachments.length > 0) {
          for (const file of entity.attachments) {
            formData.append(`entities[${i}][notes][0][images][]`, file);
          }
        }
      }
    }

    try {
      const response = await axios.post<ApiCameraFormCreateResponse>(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 30_000,
      });

      return response.data;
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;
        const serverCode = errorData?.error?.code;
        const serverMessage = errorData?.error?.message;

        if (status === 401 || serverCode === "UNAUTHORIZED") {
          throw new QAError(
            serverMessage || "Authentication failed.",
            "UNAUTHORIZED"
          );
        }
        if (status === 403 || serverCode === "FORBIDDEN") {
          throw new QAError(
            serverMessage || "You do not have permission to create camera forms.",
            "FORBIDDEN"
          );
        }
        if (status === 422 || serverCode === "VALIDATION_ERROR") {
          throw new QAError(
            serverMessage || "Validation failed. Please check your data.",
            "SERVER_ERROR"
          );
        }
        if (status === 429 || serverCode === "RATE_LIMITED") {
          const retryAfter = err.response?.headers?.["retry-after"];
          throw new QAError(
            serverMessage || "Too many requests. Please wait and try again.",
            "RATE_LIMITED",
            retryAfter ? Number(retryAfter) : undefined
          );
        }
        if (serverCode === "TIMEOUT") {
          throw new QAError(
            serverMessage || "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }
        if (!err.response || err.code === "ERR_NETWORK") {
          throw new QAError(
            "Unable to connect. Please check your internet connection.",
            "NETWORK_ERROR"
          );
        }
        if (err.code === "ECONNABORTED") {
          throw new QAError(
            "Request timed out. Please try again.",
            "TIMEOUT"
          );
        }

        throw new QAError(
          serverMessage || `Server error (${status}).`,
          "SERVER_ERROR"
        );
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Delete a camera form (audit) by ID.
   */
  async deleteCameraForm(id: number, storeId?: string): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to delete camera forms.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-forms/${id}`;

    try {
      await axios.delete(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(storeId && { "X-Store-Id": storeId }),
        },
        timeout: 15_000,
      });
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        const serverMessage = errorData?.error?.message;

        if (status === 401) {
          throw new QAError(serverMessage || "Authentication failed.", "UNAUTHORIZED");
        }
        if (status === 403) {
          throw new QAError(serverMessage || "Permission denied.", "FORBIDDEN");
        }
        if (status === 404) {
          throw new QAError(serverMessage || "Camera form not found.", "NOT_FOUND");
        }

        throw new QAError(serverMessage || `Server error (${status}).`, "SERVER_ERROR");
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },

  /**
   * Update a camera form (audit) by ID.
   */
  async updateCameraForm(
    id: number,
    storeId: number,
    date: string,
    entities: CameraFormUpdateEntityEntry[]
  ): Promise<unknown> {
    const token = getToken();
    if (!token) {
      throw new QAError(
        "You must be logged in to update camera forms.",
        "NOT_AUTHENTICATED"
      );
    }

    const url = `/api/qa/camera-forms/${id}`;

    const formData = new FormData();
    formData.append("store_id", String(storeId));
    formData.append("date", date);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      formData.append(`entities[${i}][entity_id]`, String(entity.entity_id));
      if (entity.rating_id != null) {
        formData.append(`entities[${i}][rating_id]`, String(entity.rating_id));
      }

      // Notes array
      if (entity.notes && entity.notes.length > 0) {
        for (let j = 0; j < entity.notes.length; j++) {
          const note = entity.notes[j];

          // Existing note id (for update)
          if (note.id != null) {
            formData.append(`entities[${i}][notes][${j}][id]`, String(note.id));
          }

          // Note text
          if (note.note?.trim()) {
            formData.append(`entities[${i}][notes][${j}][note]`, note.note.trim());
          }

          // New images
          if (note.images && note.images.length > 0) {
            for (const file of note.images) {
              formData.append(`entities[${i}][notes][${j}][images][]`, file);
            }
          }

          // Remove specific attachments from this note
          if (note.remove_attachment_ids && note.remove_attachment_ids.length > 0) {
            for (const attachId of note.remove_attachment_ids) {
              formData.append(`entities[${i}][notes][${j}][remove_attachment_ids][]`, String(attachId));
            }
          }
        }
      }

      // Remove entire notes
      if (entity.remove_note_ids && entity.remove_note_ids.length > 0) {
        for (const noteId of entity.remove_note_ids) {
          formData.append(`entities[${i}][remove_note_ids][]`, String(noteId));
        }
      }
    }

    try {
      const response = await axios.post(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 30_000,
      });

      return response.data;
    } catch (err) {
      if (axios.isCancel(err)) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data as
          | { error?: { code?: string; message?: string } }
          | undefined;
        const serverMessage = errorData?.error?.message;

        if (status === 401) {
          throw new QAError(serverMessage || "Authentication failed.", "UNAUTHORIZED");
        }
        if (status === 403) {
          throw new QAError(serverMessage || "Permission denied.", "FORBIDDEN");
        }
        if (status === 404) {
          throw new QAError(serverMessage || "Camera form not found.", "NOT_FOUND");
        }
        if (status === 422) {
          throw new QAError(serverMessage || "Validation failed.", "SERVER_ERROR");
        }

        throw new QAError(serverMessage || `Server error (${status}).`, "SERVER_ERROR");
      }

      throw new QAError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
        "UNKNOWN"
      );
    }
  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Camera Report transform helpers                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function transformCameraCategory(
  raw: ApiCameraReportCategory
): CameraReportCategory {
  return {
    id: raw.id,
    label: raw.label,
    sortOrder: raw.sort_order,
  };
}

function transformCameraEntity(
  raw: ApiCameraReportEntity
): CameraReportEntity {
  return {
    entityId: raw.entity_id,
    entityLabel: raw.entity_label,
    ratingCounts: raw.rating_counts.map((rc) => ({
      ratingLabel: rc.rating_label,
      count: rc.count,
    })),
    notes: raw.notes,
    category: transformCameraCategory(raw.category),
  };
}

function transformCameraSummaryItem(
  raw: ApiCameraReportSummaryItem
): CameraReportSummaryItem {
  const entities: Record<string, CameraReportEntity> = {};
  for (const [key, val] of Object.entries(raw.entities)) {
    entities[key] = transformCameraEntity(val);
  }
  return {
    storeId: raw.store_id,
    storeName: raw.store_name,
    storeGroup: raw.store_group,
    entities,
  };
}

function transformCameraEntityDef(
  raw: ApiCameraReportEntityDef
): CameraReportEntityDef {
  return {
    id: raw.id,
    entityLabel: raw.entity_label,
    categoryId: raw.category_id,
    dateRangeType: raw.date_range_type,
    reportType: raw.report_type,
    sortOrder: raw.sort_order,
    active: raw.active,
    category: transformCameraCategory(raw.category),
  };
}

function transformCameraScoreData(raw: {
  score_without_auto_fail: number;
  score_with_auto_fail: number;
}): CameraReportScoreData {
  return {
    scoreWithoutAutoFail: raw.score_without_auto_fail,
    scoreWithAutoFail: raw.score_with_auto_fail,
  };
}

function transformCameraReportResponse(
  raw: ApiCameraReportResponse
): CameraReportData {
  const scoreData: Record<string, CameraReportScoreData> = {};
  for (const [key, val] of Object.entries(raw.data.report.scoreData)) {
    scoreData[key] = transformCameraScoreData(val);
  }

  return {
    summary: raw.data.report.summary.map(transformCameraSummaryItem),
    entities: raw.data.report.entities.map(transformCameraEntityDef),
    totalStores: raw.data.report.total_stores,
    scoreData,
    stores: raw.data.stores.map((s) => ({
      id: s.id,
      store: s.store,
      group: s.group,
    })),
    groups: raw.data.groups,
    ratings: raw.data.ratings.map((r) => ({
      id: r.id,
      label: r.label,
    })),
    filters: {
      storeId: raw.data.filters.store_id,
      group: raw.data.filters.group,
      reportType: raw.data.filters.report_type,
      dateFrom: raw.data.filters.date_from,
      dateTo: raw.data.filters.date_to,
      ratingId: raw.data.filters.rating_id,
    },
  };
}
