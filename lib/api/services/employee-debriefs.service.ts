import axios from "axios";
import type {
  ApiEmployeeDebriefItem,
  ApiEmployeeDebriefDetail,
  ApiEmployeeDebriefListResponse,
  EmployeeDebriefItem,
  EmployeeDebriefDetail,
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

function transformItem(raw: ApiEmployeeDebriefItem): EmployeeDebriefItem {
  return {
    id: raw.id,
    employeeId: raw.employee_id ?? null,
    employeeName: raw.employee_name ?? null,
    storeId: raw.store_id ?? null,
    date: raw.date ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    notes: raw.note ?? raw.notes ?? null,
  };
}

function transformDetail(raw: ApiEmployeeDebriefDetail): EmployeeDebriefDetail {
  return {
    id: raw.id,
    employeeId: raw.employee_id ?? null,
    employeeName: raw.employee_name ?? null,
    storeId: raw.store_id ?? null,
    date: raw.date ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    notes: raw.note ?? raw.notes ?? null,
    content: raw.content ?? null,
    summary: raw.summary ?? null,
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
  async list(storeId: string, signal?: AbortSignal): Promise<EmployeeDebriefItem[]> {
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

  async create(
    storeId: string,
    payload: { date: string; employee_name: string; note: string }
  ): Promise<EmployeeDebriefItem> {
    const token = getToken();
    if (!token) {
      throw new EmployeeDebriefError(
        "You must be logged in to create a debrief.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.post<ApiEmployeeDebriefItem>(
        `/api/data/stores/${encodeURIComponent(storeId)}/employee-debriefs`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 15_000,
        }
      );
      return transformItem(response.data);
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
