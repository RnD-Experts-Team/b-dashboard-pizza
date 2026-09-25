import axios from "axios";
import type {
  BreakConflict,
  BreakDomainErrorCode,
  BreakErrorCode,
  BreakRunningRef,
} from "@/types/breaks.types";

/**
 * One normalised error for every failure the Breaks API (or our proxy, or the
 * network) can produce. The API has THREE body shapes, plus the proxy's own:
 *
 *   1. Domain      { message, error: { code, ...context } }
 *   2. Validation  { message, errors: { field: [msg] } }        (Laravel 422)
 *   3. Not found   { message: "No query results for model [...]" } (404, no code)
 *   4. Proxy       { success: false, error: { code, message } }   (401/502/503/504)
 *
 * UI code branches on `code` only — `message` is the server's copy and gets
 * reworded; it's kept as a fallback line, never compared against.
 */
export class BreakError extends Error {
  readonly code: BreakErrorCode;
  readonly status: number | null;
  /** Laravel field errors, first message per field. */
  readonly fieldErrors: Record<string, string>;
  /** ALREADY_ON_BREAK */
  readonly running?: BreakRunningRef;
  /** BREAK_OVERLAP */
  readonly conflicts?: BreakConflict[];
  /** BREAK_OUTSIDE_RETENTION_WINDOW */
  readonly oldestWorkDate?: string;
  /** BREAK_NOT_RUNNING */
  readonly breakId?: number;

  constructor(init: {
    code: BreakErrorCode;
    message: string;
    status?: number | null;
    fieldErrors?: Record<string, string>;
    running?: BreakRunningRef;
    conflicts?: BreakConflict[];
    oldestWorkDate?: string;
    breakId?: number;
  }) {
    super(init.message);
    this.name = "BreakError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.running = init.running;
    this.conflicts = init.conflicts;
    this.oldestWorkDate = init.oldestWorkDate;
    this.breakId = init.breakId;
  }

  /** Transport-level failures a plain retry can fix. */
  get retryable(): boolean {
    return ["TIMEOUT", "NETWORK", "SERVER"].includes(this.code);
  }
}

const DOMAIN_CODES: ReadonlySet<string> = new Set<BreakDomainErrorCode>([
  "ALREADY_ON_BREAK",
  "BREAK_OVERLAP",
  "BREAK_NOT_RUNNING",
  "BREAK_ENDS_BEFORE_START",
  "BREAK_STARTS_IN_FUTURE",
  "BREAK_OUTSIDE_RETENTION_WINDOW",
  "BREAK_CUSTOM_LABEL_REQUIRED",
  "BREAK_CUSTOM_LABEL_NOT_ALLOWED",
  "BREAK_TYPE_INACTIVE",
]);

function firstMessages(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== "object") return out;
  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    const msg = Array.isArray(value) ? value[0] : value;
    if (typeof msg === "string") out[field] = msg;
  }
  return out;
}

export function parseBreakError(err: unknown): BreakError {
  if (err instanceof BreakError) return err;

  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    return new BreakError({ code: "CANCELLED", message: "Request cancelled." });
  }

  if (!axios.isAxiosError(err)) {
    return new BreakError({
      code: "UNKNOWN",
      message: err instanceof Error ? err.message : "Something went wrong.",
    });
  }

  if (err.code === "ECONNABORTED" || /timeout/i.test(err.message)) {
    return new BreakError({ code: "TIMEOUT", message: "The request timed out." });
  }

  const status = err.response?.status ?? null;
  const data = (err.response?.data ?? {}) as Record<string, unknown>;
  const errorObj =
    data.error && typeof data.error === "object"
      ? (data.error as Record<string, unknown>)
      : null;
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof errorObj?.message === "string" && errorObj.message) ||
    err.message;

  if (!err.response) {
    return new BreakError({ code: "NETWORK", message, status });
  }

  // 1. Domain error — code-keyed, with context.
  const rawCode = typeof errorObj?.code === "string" ? errorObj.code : null;
  if (rawCode && DOMAIN_CODES.has(rawCode)) {
    return new BreakError({
      code: rawCode as BreakDomainErrorCode,
      message,
      status,
      running: errorObj?.running as BreakRunningRef | undefined,
      conflicts: Array.isArray(errorObj?.conflicts)
        ? (errorObj.conflicts as BreakConflict[])
        : undefined,
      oldestWorkDate:
        typeof errorObj?.oldest_work_date === "string"
          ? errorObj.oldest_work_date
          : undefined,
      breakId: typeof errorObj?.break_id === "number" ? errorObj.break_id : undefined,
    });
  }

  // 2. Laravel validation — field-keyed.
  if (status === 422 || data.errors) {
    return new BreakError({
      code: "VALIDATION",
      message,
      status,
      fieldErrors: firstMessages(data.errors),
    });
  }

  if (status === 401) return new BreakError({ code: "NOT_AUTHENTICATED", message, status });
  // 3. 404 means "not yours" as much as "not there" — never say "forbidden".
  if (status === 404 || status === 403) return new BreakError({ code: "NOT_FOUND", message, status });
  if (rawCode === "CONFIG_MISSING") return new BreakError({ code: "CONFIG_MISSING", message, status });
  if (status === 504 || rawCode === "TIMEOUT") return new BreakError({ code: "TIMEOUT", message, status });
  if ((status ?? 0) >= 500 || rawCode === "UPSTREAM_ERROR") return new BreakError({ code: "SERVER", message, status });

  return new BreakError({ code: "UNKNOWN", message, status });
}

/**
 * Which form field a domain code belongs to, so it can render inline under
 * the input instead of as a detached toast.
 */
export function fieldForCode(code: BreakErrorCode): string | null {
  switch (code) {
    case "BREAK_CUSTOM_LABEL_REQUIRED":
    case "BREAK_CUSTOM_LABEL_NOT_ALLOWED":
      return "other_label";
    case "BREAK_TYPE_INACTIVE":
      return "break_type_id";
    case "BREAK_ENDS_BEFORE_START":
      return "ended_at";
    case "BREAK_STARTS_IN_FUTURE":
    case "BREAK_OUTSIDE_RETENTION_WINDOW":
      return "started_at";
    default:
      return null;
  }
}
