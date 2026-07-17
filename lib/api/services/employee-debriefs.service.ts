import axios from "axios";
import type {
  ApiEmployeeObject,
  ApiEmployeeDebriefItem,
  ApiEmployeeDebriefDetail,
  ApiDebriefAttachment,
  ApiEmployeeDebriefListResponse,
  ApiPaginatedDebriefResponse,
  EmployeeDebriefItem,
  EmployeeDebriefDetail,
  DebriefAttachment,
  PaginatedDebriefResult,
} from "@/types/employee-debrief.types";

export type EmployeeDebriefErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class EmployeeDebriefError extends Error {
  readonly code: EmployeeDebriefErrorCode;
  readonly retryable: boolean;

  constructor(message: string, code: EmployeeDebriefErrorCode) {
    super(message);
    this.name = "EmployeeDebriefError";
    this.code = code;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

function resolveEmployeeName(
  employeeObj: ApiEmployeeObject | undefined | null,
  flatName: string | null | undefined,
  employeeId: number | null | undefined
): string | null {
  if (employeeObj) {
    const parts = [
      employeeObj.first_name,
      employeeObj.middle_name,
      employeeObj.last_name,
    ]
      .map((p) => p?.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  if (flatName) return flatName;
  if (employeeId != null) return null; // will fall back to ID badge in UI
  return null;
}

function transformDebriefAttachment(raw: ApiDebriefAttachment): DebriefAttachment {
  return {
    id: raw.id,
    filePath: raw.file_path ?? null,
    originalName: raw.original_name ?? null,
    mimeType: raw.mime_type ?? null,
    size: raw.size ?? null,
    attachmentUrl: raw.attachment_url ?? null,
  };
}

function transformItem(raw: ApiEmployeeDebriefItem): EmployeeDebriefItem {
  const resolvedId = raw.employee?.id ?? raw.employee_id ?? null;
  return {
    id: raw.id,
    userId: raw.user_id ?? null,
    employeeId: resolvedId,
    employeeName: resolveEmployeeName(raw.employee, raw.employee_name, resolvedId),
    authorId: raw.author?.id ?? null,
    authorName: raw.author?.name ?? null,
    storeId: raw.store_id ?? null,
    date: raw.date ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    notes: raw.note ?? raw.notes ?? null,
    attachments: (raw.attachments ?? []).map(transformDebriefAttachment),
  };
}

function transformDetail(raw: ApiEmployeeDebriefDetail): EmployeeDebriefDetail {
  const resolvedId = raw.employee?.id ?? raw.employee_id ?? null;
  return {
    id: raw.id,
    userId: raw.user_id ?? null,
    employeeId: resolvedId,
    employeeName: resolveEmployeeName(raw.employee, raw.employee_name, resolvedId),
    authorId: raw.author?.id ?? null,
    authorName: raw.author?.name ?? null,
    storeId: raw.store_id ?? null,
    date: raw.date ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    notes: raw.note ?? raw.notes ?? null,
    content: raw.content ?? null,
    summary: raw.summary ?? null,
    attachments: (raw.attachments ?? []).map(transformDebriefAttachment),
  };
}

function normalizeListResponse(raw: unknown): EmployeeDebriefItem[] {
  if (Array.isArray(raw)) {
    return (raw as ApiEmployeeDebriefItem[]).map(transformItem);
  }
  const obj = raw as ApiEmployeeDebriefListResponse;
  const list = obj?.data ?? obj?.results ?? obj?.items ?? [];
  return (list as ApiEmployeeDebriefItem[]).map(transformItem);
}

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

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message =
      data?.error?.message ||
      data?.message ||
      err.message ||
      "An unexpected error occurred.";

    if (status === 401) throw new EmployeeDebriefError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new EmployeeDebriefError(message, "FORBIDDEN");
    if (status === 404) throw new EmployeeDebriefError(message, "NOT_FOUND");
    if (status === 422) throw new EmployeeDebriefError(message, "VALIDATION_ERROR");
    if (status === 429) throw new EmployeeDebriefError(message, "RATE_LIMITED");

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new EmployeeDebriefError("The request timed out. Please try again.", "TIMEOUT");
    }

    if (!err.response) {
      throw new EmployeeDebriefError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }

    if (status && status >= 500) {
      throw new EmployeeDebriefError("Server error. Please try again later.", "SERVER_ERROR");
    }

    throw new EmployeeDebriefError(message, "UNKNOWN");
  }

  throw new EmployeeDebriefError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

export const employeeDebriefService = {
  async list(storeId: string, signal?: AbortSignal, date?: string): Promise<EmployeeDebriefItem[]> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to view employee debriefs.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          params: date ? { date } : undefined,
          timeout: 15_000,
          signal,
        }
      );
      return normalizeListResponse(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async getDetail(
    storeId: string,
    debriefId: string | number,
    signal?: AbortSignal
  ): Promise<EmployeeDebriefDetail> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to view employee debrief details.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<ApiEmployeeDebriefDetail>(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs/${encodeURIComponent(String(debriefId))}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
          signal,
        }
      );
      return transformDetail(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async listRange(
    storeId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
    employeeId?: number | null
  ): Promise<Record<string, EmployeeDebriefItem[]>> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to view employee debriefs.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs/range`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          params: { from, to, ...(employeeId != null ? { employee_id: employeeId } : {}) },
          timeout: 15_000,
          signal,
        }
      );
      // Response: { store_id, from, to, days: { "YYYY-MM-DD": [...items] } }
      const raw = response.data as { days?: Record<string, ApiEmployeeDebriefItem[]> };
      const days = raw.days ?? {};
      const result: Record<string, EmployeeDebriefItem[]> = {};
      for (const [day, items] of Object.entries(days)) {
        result[day] = (items ?? []).map(transformItem);
      }
      return result;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async create(
    storeId: string,
    payload: { date: string; employee_id: number; note: string; attachments?: File[] | null }
  ): Promise<EmployeeDebriefItem> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to create a debrief.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      let body: FormData | string;
      let headers: Record<string, string>;

      if (payload.attachments && payload.attachments.length > 0) {
        const fd = new FormData();
        fd.append("date", payload.date);
        fd.append("employee_id", String(payload.employee_id));
        fd.append("note", payload.note);
        for (const file of payload.attachments) {
          fd.append("attachments[]", file);
        }
        body = fd;
        headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      } else {
        body = JSON.stringify({ date: payload.date, employee_id: payload.employee_id, note: payload.note });
        headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" };
      }

      const response = await axios.post<ApiEmployeeDebriefItem>(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs`,
        body,
        { headers, timeout: 15_000 }
      );
      return transformItem(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async listByEmployee(
    storeId: string,
    employeeId: number,
    opts: { page?: number; perPage?: number } = {},
    signal?: AbortSignal
  ): Promise<PaginatedDebriefResult> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to view employee debriefs.",
        "NOT_AUTHENTICATED"
      );
    }

    const { page = 1, perPage = 50 } = opts;

    try {
      const response = await axios.get<ApiPaginatedDebriefResponse>(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs/employee/${encodeURIComponent(String(employeeId))}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          params: { page, per_page: perPage },
          timeout: 15_000,
          signal,
        }
      );
      const raw = response.data;
      return {
        currentPage: raw.current_page,
        perPage: raw.per_page,
        total: raw.total,
        lastPage: raw.last_page,
        items: (raw.data ?? []).map(transformItem),
      };
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async delete(storeId: string, debriefId: string | number): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to delete an employee debrief.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      await axios.delete(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs/${encodeURIComponent(String(debriefId))}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
        }
      );
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};
