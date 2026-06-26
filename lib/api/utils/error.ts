import axios from "axios";

export interface ParsedApiError {
  message: string;
  details: string[];
}

/**
 * Extracts a human-readable error from an Axios response or generic Error.
 * Laravel-style responses: { message: string, errors?: Record<string, string[]> }
 */
export function parseApiError(
  err: unknown,
  fallback = "An unexpected error occurred.",
): ParsedApiError {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as Record<string, unknown>;
    const message = typeof data.message === "string" ? data.message : null;
    const errors = data.errors;

    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const details = Object.values(errors as Record<string, string | string[]>)
        .flatMap((msgs) => (Array.isArray(msgs) ? msgs : [String(msgs)]))
        .filter(Boolean);
      if (details.length > 0) {
        return { message: message ?? "Validation failed.", details };
      }
    }

    if (message) return { message, details: [] };
  }

  if (err instanceof Error) return { message: err.message, details: [] };
  return { message: fallback, details: [] };
}
