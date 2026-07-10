import axios from "axios";

/**
 * Error helpers for the inventory feature.
 *
 * Two goals:
 *  1. Never show the user an error for a request that was simply canceled
 *     (e.g. they navigated away, or an AbortController aborted a stale fetch).
 *  2. Turn a Laravel error response ({ message, errors }) into a single
 *     human-readable string we can drop into a toast or <Alert>.
 */

// Matches words like "canceled", "cancelled", "abort", "aborted".
const cancelErrorPattern = /cancel(?:ed|led)|abort(?:ed|error)?/i;

// Matches the raw MySQL/Laravel foreign-key / integrity-constraint error that
// leaks through when deleting a row that is still referenced elsewhere. We never
// want to show this SQL text to the user — it means "record is in use".
const constraintErrorPattern =
  /SQLSTATE\[23000\]|Integrity constraint violation|foreign key constraint|\b1451\b|SQL:\s*delete from/i;

/** True when the error is just a canceled/aborted request — do NOT surface these. */
export function isCanceledError(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (
    error instanceof Error &&
    (error.name === "CanceledError" || cancelErrorPattern.test(error.message))
  ) {
    return true;
  }
  if (typeof error === "string") return cancelErrorPattern.test(error);
  return false;
}

/** True when a message string is safe to display (i.e. not a cancellation). */
export function isDisplayableErrorMessage(
  message: string | null | undefined
): message is string {
  return Boolean(message && !cancelErrorPattern.test(message));
}

/** True when the error is a 403 — used to fall back from a permission-gated
 *  endpoint (e.g. entry history) to its unrestricted counterpart. */
export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

/**
 * Extract a readable message from any inventory error.
 * Handles Laravel validation (422) by joining the first error of each field.
 */
export function getInventoryErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | {
          message?: string;
          errors?: Record<string, string[]>;
          error?: { message?: string };
        }
      | undefined;

    // 422 — collect field validation messages.
    if (status === 422 && data?.errors) {
      const lines = Object.values(data.errors)
        .flat()
        .filter(Boolean);
      if (lines.length > 0) return lines.join(" ");
    }

    // 409 / FK constraint — the record is still referenced elsewhere. Never
    // surface the raw SQL; show a clear, actionable message instead.
    if (status === 409 || constraintErrorPattern.test(data?.message ?? "")) {
      return "This item can't be deleted because it's used in one or more inventory entries.";
    }

    // 410 — public link already submitted (kept for completeness).
    if (data?.message) return data.message;

    // Synthesized { success: false, error: { code, message } } envelope —
    // emitted by the route.ts proxies on network/timeout failures.
    if (data?.error?.message) return data.error.message;

    // Common status fallbacks with clearer wording.
    if (status === 401)
      return "Unauthorized. Set a valid inventory token and try again.";
    if (status === 403) return "You are not allowed to perform this action.";
    if (status === 404) return "The requested resource was not found.";

    // Network / server unreachable.
    if (!error.response)
      return "Cannot reach the inventory server. Is it running on port 8000?";
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Returns the field-level validation errors (422) as a flat map,
 * useful for highlighting individual form fields. Empty object if none.
 */
export function getInventoryFieldErrors(
  error: unknown
): Record<string, string> {
  if (axios.isAxiosError(error) && error.response?.status === 422) {
    const data = error.response.data as
      | { errors?: Record<string, string[]> }
      | undefined;
    const out: Record<string, string> = {};
    if (data?.errors) {
      for (const [field, messages] of Object.entries(data.errors)) {
        if (messages?.[0]) out[field] = messages[0];
      }
    }
    return out;
  }
  return {};
}
