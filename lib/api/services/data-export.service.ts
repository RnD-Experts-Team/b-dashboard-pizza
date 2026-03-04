import axios from "axios";

export type ExportErrorCode =
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export class DataExportError extends Error {
  readonly code: ExportErrorCode;

  constructor(message: string, code: ExportErrorCode) {
    super(message);
    this.name = "DataExportError";
    this.code = code;
  }
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
  if (axios.isCancel(err)) {
    throw err;
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    
    // Attempt to extract JSON error message from Blob response if it failed
    let message = err.message || "An unexpected error occurred.";
    if (err.response?.data && typeof err.response.data === "object") {
       message = (err.response.data as any)?.error?.message || (err.response.data as any)?.message || message;
    } else if (err.response?.data instanceof Blob) {
       message = "Export failed. Server returned an error.";
    }

    if (status === 401) throw new DataExportError(message, "NOT_AUTHENTICATED");
    if (status === 403) throw new DataExportError(message, "FORBIDDEN");
    if (status === 404) throw new DataExportError(message, "NOT_FOUND");
    if (status === 422) throw new DataExportError(message, "VALIDATION_ERROR");
    if (status === 429) throw new DataExportError(message, "RATE_LIMITED");

    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      throw new DataExportError(
        "The request timed out. Please try again.",
        "TIMEOUT"
      );
    }

    if (!err.response) {
      throw new DataExportError(
        "Network error. Please check your connection.",
        "NETWORK_ERROR"
      );
    }

    if (status && status >= 500) {
      throw new DataExportError(
        "Server error. Please try again later.",
        "SERVER_ERROR"
      );
    }
  }

  throw new DataExportError(
    err instanceof Error ? err.message : "An unexpected error occurred.",
    "UNKNOWN"
  );
}

export const dataExportService = {
  async exportData(
    format: "csv" | "json",
    params: {
      model: string;
      start?: string;
      end?: string;
      store?: string;
    },
    signal?: AbortSignal
  ): Promise<{ data: Blob; filename: string }> {
    const token = getToken();
    if (!token) {
      throw new DataExportError(
        "You must be logged in to export data.",
        "NOT_AUTHENTICATED"
      );
    }

    try {
      const query = new URLSearchParams();
      query.append("model", params.model);
      if (params.start) query.append("start", params.start);
      if (params.end) query.append("end", params.end);
      if (params.store) query.append("store", params.store);

      const mimeType = format === "csv" ? "text/csv" : "application/json";

      const response = await axios.get<Blob>(
        `/api/data/export/${format}?${query.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: `${mimeType}, application/json`,
          },
          responseType: "blob",
          timeout: 120_000, // Exports might take a long time
          signal,
        }
      );

      // Extract filename from Content-Disposition if present
      const disposition = response.headers["content-disposition"];
      let filename = `export-${params.model}.${format}`;
      
      if (disposition && disposition.indexOf("attachment") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      return { data: response.data, filename };
    } catch (err) {
      // If we got a Blob that is actually a JSON error message, we must read it
      if (axios.isAxiosError(err) && err.response?.data instanceof Blob && err.response.data.type === "application/json") {
        try {
          const text = await err.response.data.text();
          err.response.data = JSON.parse(text);
        } catch {
          // ignore parsing error
        }
      }
      throw handleAxiosError(err);
    }
  },

  async exportCsv(
    params: {
      model: string;
      start?: string;
      end?: string;
      store?: string;
    },
    signal?: AbortSignal
  ): Promise<{ data: Blob; filename: string }> {
    return this.exportData("csv", params, signal);
  },

  async exportJson(
    params: {
      model: string;
      start?: string;
      end?: string;
      store?: string;
    },
    signal?: AbortSignal
  ): Promise<{ data: Blob; filename: string }> {
    return this.exportData("json", params, signal);
  },
};
