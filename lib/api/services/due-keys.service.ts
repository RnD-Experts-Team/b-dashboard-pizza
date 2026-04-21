import axios from "axios";
import type {
  ApiDueKeysResponse,
  DueKeysResponse,
  DueKeyItem,
  DueKeyValuePayload,
  ApiEmployee,
  Employee,
} from "@/types/due-key.types";

export type DueKeysErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class DueKeysError extends Error {
  readonly code: DueKeysErrorCode;
  readonly retryable: boolean;

  constructor(message: string, code: DueKeysErrorCode) {
    super(message);
    this.name = "DueKeysError";
    this.code = code;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

function transformDueKeyItem(raw: ApiDueKeysResponse["items"][number]): DueKeyItem {
  return {
    keyId: raw.key_id,
    label: raw.label,
    dataType: raw.data_type,
    filled: raw.filled,
    value: raw.value,
    tags: (raw.tags ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at,
      pivot: tag.pivot
        ? {
            enteredKeyId: tag.pivot.entered_key_id,
            tagId: tag.pivot.tag_id,
          }
        : undefined,
    })),
  };
}

function transformEmployee(raw: ApiEmployee): Employee {
  return {
    id: raw.id,
    firstName: raw.first_name,
    middleName: raw.middle_name ?? null,
    lastName: raw.last_name,
    storeId: raw.store_id,
    active: raw.active,
  };
}

function transformDueKeysResponse(raw: ApiDueKeysResponse): DueKeysResponse {
  return {
    storeId: raw.store_id,
    date: raw.date,
    items: (raw.items ?? []).map(transformDueKeyItem),
    employees: (raw.employees ?? []).map(transformEmployee),
  };
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

    if (status === 401) throw new DueKeysError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new DueKeysError(message, "FORBIDDEN");
    if (status === 404) throw new DueKeysError(message, "NOT_FOUND");
    if (status === 422) throw new DueKeysError(message, "VALIDATION_ERROR");
    if (status === 429) throw new DueKeysError(message, "RATE_LIMITED");

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new DueKeysError("The request timed out. Please try again.", "TIMEOUT");
    }

    if (!err.response) {
      throw new DueKeysError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }

    if (status && status >= 500) {
      throw new DueKeysError("Server error. Please try again later.", "SERVER_ERROR");
    }

    throw new DueKeysError(message, "UNKNOWN");
  }

  throw new DueKeysError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

export const dueKeysService = {
  async getDueKeys(
    storeId: string,
    date: string,
    signal?: AbortSignal,
    tags?: number[]
  ): Promise<DueKeysResponse> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to view due keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const params: Record<string, unknown> = {};
      if (tags && tags.length > 0) {
        params.tags = tags.join(",");
      }
      const response = await axios.get<ApiDueKeysResponse>(
        `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
          date
        )}/due`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
          signal,
          ...(Object.keys(params).length > 0 ? { params } : {}),
        }
      );

      return transformDueKeysResponse(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async setDueKeyValue(
    storeId: string,
    date: string,
    payload: DueKeyValuePayload
  ): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to update due key values.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      await axios.post(
        `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
          date
        )}/values`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
  async setDueKeysBulk(
    storeId: string,
    date: string,
    items: DueKeyValuePayload[]
  ): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to update due key values.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      await axios.post(
        `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
          date
        )}/values/bulk`,
        { items },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30_000,
        }
      );
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};
