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
