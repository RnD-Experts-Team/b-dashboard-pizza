import axios from "axios";
import type {
  ApiDueKeysResponse,
  ApiDueKeyItem,
  DueKeysResponse,
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
      userName: v.user_name ?? null,
      imageUrl: v.user?.image_url ?? null,
      // The grid/range API returns a full ISO timestamp here (e.g. "...T00:00:00.000000Z");
      // normalize to YYYY-MM-DD to match every other date field (and what the values-history
      // endpoint's date filter expects).
      entryDate: v.entry_date.slice(0, 10),
      valueText: v.value_text,
      valueNumber: v.value_number,
      valueBoolean: v.value_boolean,
      valueJson: v.value_json,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
      note: v.note,
      attachments,
      isMistaken: v.is_mistaken ?? false,
      supersededAt: v.superseded_at ?? null,
      correctedFromId: v.corrected_from_id ?? null,
      // The daily grid / range endpoints return only the current value (no history).
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

// Transforms a raw value object (from the POST /values + /values/bulk response bodies, and
// from the values-history listing endpoint) into a DueKeyValue, including the newest-first
// mistaken_versions history. The POST endpoints don't return a user name (caller must enrich
// it), but the listing endpoint may — so read it opportunistically rather than hardcode null.
function mapRawValue(raw: Record<string, unknown>): DueKeyValue {
  const rawHistory = (raw.mistaken_versions as unknown[]) ?? [];
  const nestedUser = raw.user as Record<string, unknown> | null | undefined;
  return {
    id: raw.id as number,
    keyId: raw.key_id as number,
    storeId: raw.store_id as string,
    userId: raw.user_id as number,
    userName: (raw.user_name as string | null | undefined) ?? (nestedUser?.name as string | null | undefined) ?? null,
    entryDate: (raw.entry_date as string).slice(0, 10),
    valueText: (raw.value_text as string | null) ?? null,
    valueNumber: (raw.value_number as number | null) ?? null,
    valueBoolean: (raw.value_boolean as boolean | null) ?? null,
    valueJson: raw.value_json ?? null,
    note: (raw.note as string | null) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
    isMistaken: (raw.is_mistaken as boolean | undefined) ?? false,
    supersededAt: (raw.superseded_at as string | null) ?? null,
    correctedFromId: (raw.corrected_from_id as number | null) ?? null,
    mistakenVersions: rawHistory.map((h) => mapRawValue(h as Record<string, unknown>)),
    attachments: ((raw.attachments as unknown[]) ?? []).map((a) => {
      const att = a as Record<string, unknown>;
      return {
        id: att.id as number,
        enteredKeyValueId: att.entered_key_value_id as number,
        filePath: att.file_path as string,
        originalName: att.original_name as string,
        mimeType: att.mime_type as string,
        size: att.size as number,
        attachmentUrl: att.attachment_url as string,
      } satisfies DueKeyAttachment;
    }),
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
  ): Promise<import("@/lib/hooks/use-due-keys-feed").DayPage[]> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to view due keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const params: Record<string, unknown> = { from, to };
      if (tags && tags.length > 0) {
        params.tags = tags.join(",");
      }
      const response = await axios.get<{
        store_id: string;
        from: string;
        to: string;
        days: Record<string, ApiDueKeyItem[]>;
      }>(
        `/api/data/stores/${encodeURIComponent(storeId)}/due-range`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
          signal,
          params,
        }
      );

      const daysObj = response.data?.days ?? {};
      return Object.entries(daysObj).map(([date, items]) => ({
        date,
        items: (items ?? []).map(transformDueKeyItem),
        employees: [],
      }));
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async setDueKeyValue(
    storeId: string,
    date: string,
    payload: DueKeyValuePayload
  ): Promise<DueKeyValue> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to update due key values.",
        "NOT_AUTHENTICATED"
      );
    }

    const hasAttachments = payload.attachments && payload.attachments.length > 0;
    const url = `/api/data/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(date)}/values`;

    try {
      if (hasAttachments) {
        const formData = new FormData();
        formData.append("key_id", String(payload.key_id));

        if (payload.value_text !== null && payload.value_text !== undefined) {
          formData.append("value_text", payload.value_text);
        }
        if (payload.value_number !== null && payload.value_number !== undefined) {
          formData.append("value_number", String(payload.value_number));
        }
        if (payload.value_boolean !== null && payload.value_boolean !== undefined) {
          formData.append("value_boolean", payload.value_boolean ? "1" : "0");
        }
        if (payload.value_json !== null && payload.value_json !== undefined) {
          formData.append("value_json", JSON.stringify(payload.value_json));
        }
        if (payload.note) {
          formData.append("note", payload.note);
        }
        for (const file of payload.attachments!) {
          formData.append("attachments[]", file);
        }

        const formResponse = await axios.post(url, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            // Do not set Content-Type — axios sets it with the correct multipart boundary
          },
          timeout: 30_000,
        });
        return mapRawValue(formResponse.data as Record<string, unknown>);
      } else {
        const { attachments: _a, ...jsonPayload } = payload;
        const jsonResponse = await axios.post(url, jsonPayload, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 30_000,
        });
        return mapRawValue(jsonResponse.data as Record<string, unknown>);
      }
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
  async setDueKeysBulk(
    storeId: string,
    date: string,
    items: DueKeyValuePayload[]
  ): Promise<DueKeyValue[]> {
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

        const formResponse = await axios.post(
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
        return mapBulkResponse(formResponse.data);
      } else {
        // No attachments — use JSON for efficiency
        const jsonItems = items.map(({ attachments: _a, ...rest }) => rest);
        const jsonResponse = await axios.post(
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
        return mapBulkResponse(jsonResponse.data);
      }
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  // Fetches the full value history (current + mistaken rows) for one key/date from the
  // store-level listing endpoint, which — unlike the daily grid/range endpoints — intentionally
  // still includes superseded rows. The exact upstream filter params aren't guaranteed, so we
  // send best-effort filters and always narrow client-side to be correct regardless.
  async getValueHistory(
    storeId: string,
    keyId: number,
    date: string,
    signal?: AbortSignal
  ): Promise<DueKeyValue[]> {
    const token = getToken();
    if (!token) {
      throw new DueKeysError(
        "You must be logged in to view value history.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get(
        `/api/data/stores/${encodeURIComponent(storeId)}/values`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 15_000,
          signal,
          params: { key_id: keyId, date },
        }
      );

      const raw = response.data as unknown;
      const list: unknown[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown[] })?.data)
          ? (raw as { data: unknown[] }).data
          : Array.isArray((raw as { items?: unknown[] })?.items)
            ? (raw as { items: unknown[] }).items
            : Array.isArray((raw as { values?: unknown[] })?.values)
              ? (raw as { values: unknown[] }).values
              : [];

      return list
        .map((v) => mapRawValue(v as Record<string, unknown>))
        .filter((v) => v.keyId === keyId && v.entryDate === date)
        .sort((a, b) => {
          if (a.isMistaken !== b.isMistaken) return a.isMistaken ? 1 : -1;
          const at = a.supersededAt ?? a.updatedAt;
          const bt = b.supersededAt ?? b.updatedAt;
          return bt.localeCompare(at);
        });
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};

// Maps the { items: [...] } bulk-save response body into DueKeyValue[].
// Tolerant of the legacy shape ({ success: true }) → returns [].
function mapBulkResponse(data: unknown): DueKeyValue[] {
  const items = (data as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return [];
  return items.map((it) => mapRawValue(it as Record<string, unknown>));
}
