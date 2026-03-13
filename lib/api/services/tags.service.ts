import axios from "axios";
import type {
  ApiTag,
  ApiTagsListResponse,
  Tag,
  TagsListResponse,
  CreateTagPayload,
} from "@/types/tag.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error Handling                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type TagsErrorCode =
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

export class TagsError extends Error {
  readonly code: TagsErrorCode;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(message: string, code: TagsErrorCode, retryAfter?: number) {
    super(message);
    this.name = "TagsError";
    this.code = code;
    this.retryAfter = retryAfter;
    this.retryable = ["TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"].includes(code);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Transform helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function transformTag(raw: ApiTag): Tag {
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function normaliseTagsList(raw: ApiTagsListResponse): TagsListResponse {
  const items = Array.isArray(raw) ? raw : (raw.data ?? []);
  return { data: items.map(transformTag) };
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
/*  Axios error → TagsError                                                 */
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

    if (status === 401) throw new TagsError(msg, "NOT_AUTHENTICATED");
    if (status === 403) throw new TagsError(msg, "FORBIDDEN");
    if (status === 404) throw new TagsError(msg, "NOT_FOUND");
    if (status === 422) throw new TagsError(msg, "VALIDATION_ERROR");
    if (status === 429) {
      const retryAfter =
        Number(err.response?.headers?.["retry-after"]) || undefined;
      throw new TagsError(msg, "RATE_LIMITED", retryAfter);
    }
    if (
      err.code === "ECONNABORTED" ||
      err.message?.includes("timeout")
    ) {
      throw new TagsError("The request timed out. Please try again.", "TIMEOUT");
    }
    if (!err.response) {
      throw new TagsError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }
    if (status && status >= 500) {
      throw new TagsError("Server error. Please try again later.", "SERVER_ERROR");
    }
    throw new TagsError(msg, "UNKNOWN");
  }
  throw new TagsError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Service                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const tagsService = {
  /**
   * Fetch all tags.
   */
  async getTags(signal?: AbortSignal): Promise<TagsListResponse> {
    const token = getToken();
    if (!token) {
      throw new TagsError(
        "You must be logged in to view tags.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<ApiTagsListResponse>(`/api/data/tags`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
        signal,
      });
      return normaliseTagsList(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Create a new tag.
   */
  async createTag(payload: CreateTagPayload): Promise<Tag> {
    const token = getToken();
    if (!token) {
      throw new TagsError(
        "You must be logged in to create a tag.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.post<ApiTag>(`/api/data/tags`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15_000,
      });
      return transformTag(response.data);
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Delete a single tag by ID.
   */
  async deleteTag(id: number): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new TagsError(
        "You must be logged in to delete a tag.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      await axios.delete(`/api/data/tags/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 15_000,
      });
    } catch (err) {
      return handleAxiosError(err);
    }
  },

  /**
   * Bulk delete tags.
   * Body shape expected by the upstream: { data: { ids: number[] } }
   */
  async deleteTagsBulk(ids: number[]): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new TagsError(
        "You must be logged in to delete tags.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      await axios.delete(`/api/data/tags/bulk`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        data: { ids },
        timeout: 15_000,
      });
    } catch (err) {
      return handleAxiosError(err);
    }
  },
};
