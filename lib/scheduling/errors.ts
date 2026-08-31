import axios from "axios";
import {
  FORCEABLE_ERROR_CODES,
  SETUP_ERROR_CODES,
  type EmployeeSyncRequestStatus,
  type SchedulingErrorCode,
} from "@/types/scheduling.types";

/**
 * Normalising scheduling API failures into something the UI can show verbatim.
 *
 * The point of this module is that the BACKEND'S OWN MESSAGE reaches the user.
 * A bare "Request failed with status code 409" tells a manager nothing; "Marco
 * Rossi already has an overlapping shift" tells them exactly what to do. So the
 * server's `message` is always preferred, and per-field validation errors are
 * kept separately so a form can show them inline.
 *
 * Three different envelopes are in play, and all three are handled:
 *
 *   1. Domain errors from OperationsPizza
 *        { message: "...", error: { code: "SHIFT_CONFLICT", ... } }
 *
 *   2. Laravel validation failures — note there is NO `error.code` here, so
 *      `errors` must be checked BEFORE assuming a domain code
 *        { message: "...", errors: { start_time: ["..."] } }
 *
 *   3. Our own proxy's transport errors, which follow this repo's convention
 *        { success: false, error: { code: "TIMEOUT", message: "..." } }
 *
 * Always branch on `code`, never on the message text — messages are
 * human-readable and change.
 */

export interface SchedulingError {
  /** Domain or transport code, when the response carried one. */
  code: SchedulingErrorCode | string | null;
  /** The server's own human-readable message. Safe to show as-is. */
  message: string;
  /** Per-field validation messages, for inline form display. */
  fieldErrors: Record<string, string[]>;
  /** Flattened validation messages, when a list is more useful than a map. */
  details: string[];
  status: number | null;
  /** Seconds to wait, from a 503 `Retry-After` or an error payload. */
  retryAfterSeconds: number | null;
  /** True for the three 409s a manager may override by resending with `force`. */
  isForceable: boolean;
  /** True for configuration failures a manager retrying will never fix. */
  isSetup: boolean;
  /** True when a published shift needs `?confirm=true` to delete. */
  needsConfirm: boolean;
  /** Present only on EMPLOYEE_NOT_SYNCED — this is a wait, not a failure. */
  sync: {
    employeeId: string | null;
    employeeName: string | null;
    status: EmployeeSyncRequestStatus | null;
    retryAfterSeconds: number;
    lastError: string | null;
  } | null;
  /** The raw payload, for logging. Never render this. */
  raw: unknown;
}

const GENERIC_FALLBACK =
  "Something went wrong talking to the scheduling service. Please try again.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function flattenFieldErrors(
  errors: unknown
): { fieldErrors: Record<string, string[]>; details: string[] } {
  const record = asRecord(errors);
  if (!record) return { fieldErrors: {}, details: [] };

  const fieldErrors: Record<string, string[]> = {};
  const details: string[] = [];
  for (const [field, raw] of Object.entries(record)) {
    const messages = (Array.isArray(raw) ? raw : [raw])
      .map((m) => (typeof m === "string" ? m : String(m)))
      .filter(Boolean);
    if (messages.length > 0) {
      fieldErrors[field] = messages;
      details.push(...messages);
    }
  }
  return { fieldErrors, details };
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Turn any thrown value from the scheduling service into a displayable error.
 *
 * `fallback` is used only when the response carried no message at all — prefer
 * passing an action-specific one ("Could not save this shift.") so the user
 * still gets context on a bare network failure.
 */
export function parseSchedulingError(
  err: unknown,
  fallback: string = GENERIC_FALLBACK
): SchedulingError {
  const base: SchedulingError = {
    code: null,
    message: fallback,
    fieldErrors: {},
    details: [],
    status: null,
    retryAfterSeconds: null,
    isForceable: false,
    isSetup: false,
    needsConfirm: false,
    sync: null,
    raw: err,
  };

  if (!axios.isAxiosError(err)) {
    return err instanceof Error && err.message
      ? { ...base, message: err.message }
      : base;
  }

  base.status = err.response?.status ?? null;

  const data = asRecord(err.response?.data);
  if (!data) {
    // No parseable body — a network drop, or an HTML error page.
    return {
      ...base,
      message: err.message || fallback,
    };
  }

  const errorObj = asRecord(data.error);

  // Validation failures carry `errors` and NO `error.code`, so check them first.
  const { fieldErrors, details } = flattenFieldErrors(data.errors);

  const code =
    (typeof errorObj?.code === "string" ? errorObj.code : null) ?? null;

  // Prefer the top-level message, then a nested one, then the field errors.
  const message =
    (typeof data.message === "string" && data.message.trim()
      ? data.message.trim()
      : null) ??
    (typeof errorObj?.message === "string" && errorObj.message.trim()
      ? errorObj.message.trim()
      : null) ??
    (details.length > 0 ? details[0] : null) ??
    err.message ??
    fallback;

  const headerRetry = toNumber(err.response?.headers?.["retry-after"]);
  const payloadRetry =
    toNumber(errorObj?.retry_after_seconds) ?? toNumber(errorObj?.retryAfter);

  const sync =
    code === "EMPLOYEE_NOT_SYNCED"
      ? {
          employeeId:
            typeof errorObj?.employee_id === "string"
              ? errorObj.employee_id
              : null,
          employeeName:
            typeof errorObj?.employee_name === "string"
              ? errorObj.employee_name
              : null,
          status:
            typeof errorObj?.sync_status === "string"
              ? (errorObj.sync_status as EmployeeSyncRequestStatus)
              : null,
          retryAfterSeconds: payloadRetry ?? 5,
          lastError:
            typeof errorObj?.sync_last_error === "string"
              ? errorObj.sync_last_error
              : null,
        }
      : null;

  return {
    ...base,
    code,
    message,
    fieldErrors,
    details,
    retryAfterSeconds: headerRetry ?? payloadRetry,
    isForceable: Boolean(
      code && FORCEABLE_ERROR_CODES.includes(code as SchedulingErrorCode)
    ),
    isSetup: Boolean(
      code && SETUP_ERROR_CODES.includes(code as SchedulingErrorCode)
    ),
    needsConfirm: code === "SHIFT_PUBLISHED",
    sync,
  };
}

/**
 * Short label for an error code, for a badge next to the server's message.
 *
 * Deliberately does NOT replace the message — it supplements it. The server's
 * wording is the useful part; this is just a compact category.
 */
export function errorCodeLabel(code: string | null): string | null {
  if (!code) return null;
  const LABELS: Record<string, string> = {
    EMPLOYEE_NOT_SYNCED: "Setting up employee",
    SHIFT_CONFLICT: "Overlapping shift",
    EMPLOYEE_UNAVAILABLE: "Unavailable",
    EMPLOYEE_ON_TIME_OFF: "On time off",
    SHIFT_PUBLISHED: "Already published",
    TIME_OFF_READ_ONLY: "Managed in HR",
    INVALID_LOCAL_TIME: "Invalid time",
    STORE_NOT_MAPPED: "Store not set up",
    POSITION_NOT_MAPPED: "Position not set up",
    EMPLOYEE_NOT_IN_STORE: "Not at this store",
    SHIFT_UNASSIGNED: "Unassigned shift",
    HUMANITY_WRITE_FAILED: "Scheduling system rejected it",
    HUMANITY_RATE_LIMITED: "Too many requests",
    TIMEOUT: "Timed out",
    UPSTREAM_ERROR: "Service unreachable",
    NOT_AUTHENTICATED: "Signed out",
    FORBIDDEN: "No permission",
    VALIDATION_ERROR: "Check the details",
  };
  return LABELS[code] ?? null;
}

/**
 * Whether the caller should treat this as "nothing was written".
 *
 * Every domain refusal and transport failure leaves the schedule untouched, so
 * retrying is safe. The one thing this is NOT true of is a successful response
 * with `syncStatus: "pending"` — that shift IS saved.
 */
export function isSafeToRetry(error: SchedulingError): boolean {
  if (error.status === 401 || error.status === 403) return false;
  return true;
}
