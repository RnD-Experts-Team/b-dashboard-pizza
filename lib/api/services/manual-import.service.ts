import axios from "axios";

export type ManualImportErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class ManualImportError extends Error {
  readonly code: ManualImportErrorCode;

  constructor(message: string, code: ManualImportErrorCode) {
    super(message);
    this.name = "ManualImportError";
    this.code = code;
  }
}

export interface ImportEntryFile {
  filename?: string;
  name?: string;
  [key: string]: unknown;
}

export interface InspectZipResponse {
  temp_id?: string;
  files?: ImportEntryFile[];
  [key: string]: unknown;
}

export interface UploadImportResponse {
  upload_id?: string;
  [key: string]: unknown;
}

const PROCESSOR_FIELD_KEYS = [
  "processor_key",
  "processorKey",
  "processor",
  "key",
  "value",
  "slug",
  "name",
  "id",
] as const;

const PROCESSOR_CONTAINER_KEYS = [
  "processors",
  "processor_keys",
  "processorKeys",
  "items",
  "results",
  "data",
  "available_processors",
  "availableProcessors",
  "manual_import",
  "manualImport",
  "mappings",
  "mapping",
] as const;

const PROCESSOR_KEY_BLOCKLIST = new Set([
  "success",
  "status",
  "message",
  "error",
  "errors",
  "meta",
  "data",
  "result",
  "results",
  "items",
  "list",
  "processors",
  "id",
  "name",
  "key",
  "value",
  "slug",
  "label",
  "title",
  "processor",
  "processor_key",
  "processorkey",
]);

function normalizeProcessorKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractProcessorKeys(payload: unknown): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  const push = (candidate: unknown) => {
    if (typeof candidate !== "string") return;
    const normalized = normalizeProcessorKey(candidate);
    if (!normalized) return;
    if (PROCESSOR_KEY_BLOCKLIST.has(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    keys.push(normalized);
  };

  const readEntry = (entry: unknown) => {
    if (typeof entry === "string") {
      push(entry);
      return;
    }

    const record = asRecord(entry);
    if (!record) return;

    for (const fieldKey of PROCESSOR_FIELD_KEYS) {
      push(record[fieldKey]);
    }
  };

  const readCollection = (collection: unknown) => {
    if (Array.isArray(collection)) {
      collection.forEach(readEntry);
      return;
    }

    const record = asRecord(collection);
    if (!record) return;

    for (const [mapKey, mapValue] of Object.entries(record)) {
      if (
        typeof mapValue !== "undefined" &&
        !PROCESSOR_KEY_BLOCKLIST.has(mapKey.toLowerCase()) &&
        /^[a-z0-9_]+$/i.test(mapKey)
      ) {
        push(mapKey);
      }
      readEntry(mapValue);
    }
  };

  readCollection(payload);

  const rootRecord = asRecord(payload);
  if (rootRecord) {
    for (const key of PROCESSOR_CONTAINER_KEYS) {
      readCollection(rootRecord[key]);
    }

    const nestedData = asRecord(rootRecord.data);
    if (nestedData) {
      for (const key of PROCESSOR_CONTAINER_KEYS) {
        readCollection(nestedData[key]);
      }
    }
  }

  return keys.sort((a, b) => a.localeCompare(b));
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
    const data = err.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    const message =
      data?.error?.message ||
      data?.message ||
      err.message ||
      "An unexpected error occurred.";

    if (status === 401) throw new ManualImportError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new ManualImportError(message, "FORBIDDEN");
    if (status === 404) throw new ManualImportError(message, "NOT_FOUND");
    if (status === 422) throw new ManualImportError(message, "VALIDATION_ERROR");
    if (status === 429) throw new ManualImportError(message, "RATE_LIMITED");

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new ManualImportError(
        "The request timed out. Please try again.",
        "TIMEOUT"
      );
    }

    if (!err.response) {
      throw new ManualImportError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }

    if (status && status >= 500) {
      throw new ManualImportError(
        "Server error. Please try again later.",
        "SERVER_ERROR"
      );
    }
  }

  throw new ManualImportError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

export const manualImportService = {
  async getProcessors(): Promise<string[]> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to load processor keys.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<unknown>("/api/data/manual-import", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: 20_000,
      });

      return extractProcessorKeys(response.data);
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async inspectZip(file: File): Promise<InspectZipResponse> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to inspect ZIP files.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post<InspectZipResponse>(
        "/api/data/manual-import/inspect-zip",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 30_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async upload(
    files: File[],
    mappings: Record<string, string>,
    tempId?: string
  ): Promise<UploadImportResponse> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to upload import files.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("mappings", JSON.stringify(mappings));
      if (tempId) formData.append("temp_id", tempId);

      const response = await axios.post<UploadImportResponse>(
        "/api/data/manual-import/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 60_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async getImportProgress(uploadId: string): Promise<Record<string, unknown>> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to check import progress.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<Record<string, unknown>>(
        `/api/data/manual-import/progress/${encodeURIComponent(uploadId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 20_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async triggerReaggregation(payload: {
    start_date: string;
    end_date: string;
    type: "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "all";
  }): Promise<Record<string, unknown>> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to trigger re-aggregation.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.post<Record<string, unknown>>(
        "/api/data/manual-import/reaggregate",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },

  async getAggregationProgress(
    aggregationId: string
  ): Promise<Record<string, unknown>> {
    const token = getToken();
    if (!token) {
      throw new ManualImportError(
        "You must be logged in to check aggregation progress.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const response = await axios.get<Record<string, unknown>>(
        `/api/data/manual-import/aggregation-progress/${encodeURIComponent(aggregationId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: 20_000,
        }
      );

      return response.data;
    } catch (err) {
      throw handleAxiosError(err);
    }
  },
};
