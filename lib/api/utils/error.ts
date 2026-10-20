import axios from "axios";

/**
 * Shown for 429 (rate limited) and 503 (a backend or its auth server is
 * overloaded). Neither means the session is bad, so neither logs anyone out.
 */
export const BUSY_MESSAGE = "The server is busy. Please try again in a moment.";

export function isBusyStatus(status: number | null | undefined): boolean {
  return status === 429 || status === 503;
}

/** Seconds from a `Retry-After` header (seconds form only), or null. */
export function retryAfterSeconds(err: unknown): number | null {
  if (!axios.isAxiosError(err)) return null;
  const seconds = Number(err.response?.headers?.["retry-after"]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

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
