import axios from "axios";
import type {
  ApiKeysListResponse,
  ApiKey,
  KeysListResponse,
  EngineKey,
  StoreRule,
  ApiStoreRule,
  CreateKeyPayload,
  UpdateKeyPayload,
} from "@/types/key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type KeysErrorCode =
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class KeysError extends Error {
  readonly code: KeysErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(message: string, code: KeysErrorCode, retryAfter?: number) {
    super(message);
    this.name = "KeysError";
    this.code = code;
    this.retryAfter = retryAfter;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(
      code
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers — snake_case → camelCase                              */
/* ────────────────────────────────────────────────────────────────────────── */

function transformStoreRule(raw: ApiStoreRule): StoreRule {
  return {
    id: raw.id,
    storeId: raw.store_id,
    frequencyType: raw.frequency_type,
    interval: raw.interval,
    weekDays: raw.week_days,
    monthDay: raw.month_day,
    weekOfMonth: raw.week_of_month,
    weekDay: raw.week_day,
    yearMonth: raw.year_month,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    fillMode: raw.fill_mode ?? "store_once",
    roleNames: raw.role_names ?? null,
    time: raw.time ?? null,
  };
}

function transformKey(raw: ApiKey): EngineKey {
  // The API may return tags as full objects {id, name, ...} or as plain integers.
  const tags = (raw.tags ?? []).map((t) =>
    typeof t === "object" && t !== null ? (t as { id: number }).id : (t as number)
  );
  return {
    id: raw.id,
    label: raw.label,
    dataType: raw.data_type,
    isActive: raw.is_active,
    storeRules: (raw.store_rules ?? []).map(transformStoreRule),
    tags,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function transformKeysListResponse(raw: ApiKeysListResponse): KeysListResponse {
  // Be defensive: upstream may omit `meta` or `links` in some responses.
  const meta = raw.meta ?? {
    current_page: 1,
    from: null,
    last_page: 1,
    path: "",
    per_page: raw.data?.length ?? 0,
    to: null,
    total: raw.data?.length ?? 0,
  };
  const links = raw.links ?? { first: null, last: null, prev: null, next: null };

  return {
    data: (raw.data ?? []).map(transformKey),
    pagination: {
      currentPage: meta.current_page ?? 1,
      from: meta.from ?? null,
      lastPage: meta.last_page ?? 1,
      perPage: meta.per_page ?? (raw.data?.length ?? 0),
      to: meta.to ?? null,
      total: meta.total ?? (raw.data?.length ?? 0),
    },
    hasNextPage: links.next !== null && links.next !== undefined,
    hasPrevPage: links.prev !== null && links.prev !== undefined,
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Axios error → KeysError                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function handleAxiosError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg =
      data?.error?.message ||
      data?.message ||
      err.message ||
      "An unexpected error occurred.";

    if (status === 401)
      throw new KeysError(msg, "NOT_AUTHENTICATED");
    if (status === 403) throw new KeysError(msg, "FORBIDDEN");
    if (status === 404) throw new KeysError(msg, "NOT_FOUND");
    if (status === 422)
      throw new KeysError(msg, "VALIDATION_ERROR");
    if (status === 429) {
      const retryAfter = Number(err.response?.headers?.["retry-after"]) || undefined;
      throw new KeysError(msg, "RATE_LIMITED", retryAfter);
    }
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new KeysError(
        "The request timed out. Please try again.",
        "TIMEOUT"
      );
    }
    if (!err.response) {
      throw new KeysError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }
    if (status && status >= 500) {
      throw new KeysError("Server error. Please try again later.", "SERVER_ERROR");
    }
    throw new KeysError(msg, "UNKNOWN");
  }
  throw new KeysError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const keysService = {
  /**
   * Fetch paginated list of engine keys.
   */
  async getKeys(
    page: number = 1,
    signal?: AbortSignal,
    tags?: number[]
  ): Promise<KeysListResponse> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to view keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const params: Record<string, unknown> = { page };
      if (tags && tags.length > 0) {
        params.tags = tags.join(",");
      }
      const response = await axios.get<ApiKeysListResponse>(`/api/data/keys`, {
        params,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformKeysListResponse(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Fetch a single engine key by ID.
   */
  async getKeyById(
    id: number,
    signal?: AbortSignal
  ): Promise<EngineKey> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to view key details.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<ApiKey>(`/api/data/keys/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });

      return transformKey(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Create a new engine key.
   */
  async createKey(payload: CreateKeyPayload): Promise<EngineKey> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to create keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.post<ApiKey>(`/api/data/keys`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15_000,
      });

      return transformKey(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Update an existing engine key.
   */
  async updateKey(id: number, payload: UpdateKeyPayload): Promise<EngineKey> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to update keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.put<ApiKey>(
        `/api/data/keys/${id}`,
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

      return transformKey(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Deactivate (soft-delete) an engine key.
   */
  async deactivateKey(id: number): Promise<{ message: string }> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to deactivate keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.delete<{ message: string }>(
        `/api/data/keys/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Restore (reactivate) a previously deactivated engine key.
   */
  async restoreKey(id: number): Promise<{ message: string }> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to restore keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.patch<{ message: string }>(
        `/api/data/keys/${id}/restore`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  /**
   * Permanently (force) delete an engine key.
   */
  async forceDeleteKey(id: number): Promise<{ message: string }> {
    const token = getToken();
    if (!token) {
      throw new KeysError(
        "You must be logged in to delete keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.delete<{ message: string }>(
        `/api/data/keys/${id}/force-delete`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};
