import axios from "axios";
import type {
  ApiDueKeysResponse,
  ApiDueRangeResponse,
  DueKeysResponse,
  DueRangeEntry,
  DueKeyItem,
  DueKeyValue,
  DueKeyAttachment,
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
  let value: DueKeyValue | null = null;
  if (raw.value) {
    const v = raw.value;
    const attachments: DueKeyAttachment[] = (v.attachments ?? []).map((a) => ({
      id: a.id,
      enteredKeyValueId: a.entered_key_value_id,
      filePath: a.file_path,
      originalName: a.original_name,
      mimeType: a.mime_type,
      size: a.size,
      attachmentUrl: a.attachment_url,
    }));
    value = {
      id: v.id,
      keyId: v.key_id,
      storeId: v.store_id,
      userId: v.user_id,
      entryDate: v.entry_date,
      valueText: v.value_text,
      valueNumber: v.value_number,
      valueBoolean: v.value_boolean,
      valueJson: v.value_json,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
      note: v.note,
      attachments,
    };
  }
  return {
    keyId: raw.key_id,
    label: raw.label,
    dataType: raw.data_type,
    filled: raw.filled,
    value,
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

  async getDueRange(
    storeId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
    tags?: number[]
  ): Promise<DueRangeEntry[]> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError("You must be logged in to view due keys.", "NOT_AUTHENTICATED");
    }

    try {
      const params: Record<string, unknown> = { from, to };
      if (tags && tags.length > 0) params.tags = tags.join(",");

      // The range endpoint returns:
      // { store_id, from, to, days: { "YYYY-MM-DD": ApiDueKeyItem[] } }
      const response = await axios.get<ApiDueRangeResponse>(
        `/api/data/stores/${encodeURIComponent(storeId)}/due-range`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          timeout: 300_000, // 5 minutes
          signal,
          params,
        }
      );

      const days = response.data?.days ?? {};
      return Object.entries(days)
        .map(([date, items]) => ({
          date,
          items: (items ?? []).map(transformDueKeyItem),
          employees: [] as Employee[],
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
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

    const formData = new FormData();
    formData.append("key_id", String(payload.key_id));

    if (payload.value_text !== null && payload.value_text !== undefined) {
      formData.append("value_text", payload.value_text);
    }
    if (payload.value_number !== null && payload.value_number !== undefined) {
      formData.append("value_number", String(payload.value_number));
    }
    if (payload.value_boolean !== null && payload.value_boolean !== undefined) {
      formData.append("value_boolean", String(payload.value_boolean));
    }
    if (payload.value_json !== null && payload.value_json !== undefined) {
      formData.append("value_json", JSON.stringify(payload.value_json));
    }
    if (payload.note) {
      formData.append("note", payload.note);
    }
    if (payload.attachments && payload.attachments.length > 0) {
      for (const file of payload.attachments) {
        formData.append("attachments[]", file);
      }
    }

    try {
      await axios.post(
        `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
          date
        )}/values`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            // Do not set Content-Type — axios sets it with the correct multipart boundary
          },
          timeout: 30_000,
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

    const hasAttachments = items.some(
      (item) => item.attachments && item.attachments.length > 0
    );

    try {
      if (hasAttachments) {
        // Build multipart/form-data with indexed fields for each item
        const formData = new FormData();
        items.forEach((item, idx) => {
          formData.append(`items[${idx}][key_id]`, String(item.key_id));
          if (item.value_text !== null && item.value_text !== undefined) {
            formData.append(`items[${idx}][value_text]`, item.value_text);
          }
          if (item.value_number !== null && item.value_number !== undefined) {
            formData.append(`items[${idx}][value_number]`, String(item.value_number));
          }
          if (item.value_boolean !== null && item.value_boolean !== undefined) {
            formData.append(`items[${idx}][value_boolean]`, String(item.value_boolean));
          }
          if (item.value_json !== null && item.value_json !== undefined) {
            formData.append(`items[${idx}][value_json]`, JSON.stringify(item.value_json));
          }
          if (item.note) {
            formData.append(`items[${idx}][note]`, item.note);
          }
          if (item.attachments && item.attachments.length > 0) {
            for (const file of item.attachments) {
              formData.append(`items[${idx}][attachments][]`, file);
            }
          }
        });

        await axios.post(
          `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
            date
          )}/values/bulk`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            timeout: 60_000,
          }
        );
      } else {
        // No attachments — use JSON for efficiency
        const jsonItems = items.map(({ attachments: _a, ...rest }) => rest);
        await axios.post(
          `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
            date
          )}/values/bulk`,
          { items: jsonItems },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            timeout: 30_000,
          }
        );
      }
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};
