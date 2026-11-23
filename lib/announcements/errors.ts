import axios from "axios";

/**
 * Normalising Announcements API failures into something the UI can show.
 *
 * The BACKEND'S OWN MESSAGE is what the user should read ("The ends at field
 * must be a date after or equal to starts at."), so it is kept verbatim in
 * `serverMessage`. Per-field Laravel validation errors are kept apart so a form
 * can show them inline.
 *
 * Envelopes handled:
 *   1. Laravel validation (422)     { message, errors: { field: [msg] } }
 *   2. Our own BFF/proxy transport  { success: false, error: { code, message } }
 *   3. Plain Laravel errors         { message }
 *   4. Axios failures with no response (network drop, timeout, abort)
 *
 * Always branch on `kind`, never on the message text.
 *
 * This file is pure: it never calls a hook and never touches the DOM. Where a
 * fallback sentence is needed it is short English; the UI translates by `kind`
 * (see the `announcements.errors.*` messages) through `describeAnnouncementError`.
 */

export type AnnouncementErrorKind =
  | "validation"
  | "auth"
  | "forbidden"
  | "notFound"
  | "rateLimited"
  | "network"
  | "timeout"
  | "server"
  /** A chunk upload whose upload_uuid the server no longer knows. */
  | "uploadExpired"
  /** 413: the request body was bigger than the server accepts. */
  | "tooLarge"
  /** The user (or an unmount) aborted the request. Not a failure to report. */
  | "cancelled"
  /** Anything else (a bug, an unexpected throw). */
  | "unknown";

export interface AnnouncementError {
  kind: AnnouncementErrorKind;
  /** HTTP status, when the server answered. */
  status: number | null;
  /**
   * What to show when no translation is wanted: the backend's own message when
   * it sent one, otherwise a short English fallback for the kind.
   */
  message: string;
  /** The backend's own words, or null when it sent none. Verbatim. */
  serverMessage: string | null;
  /** Per-field validation messages, for inline form display. */
  fieldErrors: Record<string, string[]>;
  /** Flattened validation messages, when a list is more useful than a map. */
  details: string[];
  /** Seconds to wait, from a `Retry-After` header or an error payload. */
  retryAfterSeconds: number | null;
  /** Machine code from our proxy envelope, or a client-side code. */
  code: string | null;
  /** The raw thrown value, for logging. Never render this. */
  raw: unknown;
}

export interface ParseErrorOptions {
  /**
   * Set for the video upload calls. Only a chunk request can mean "the server
   * forgot this upload_uuid", so only `"upload-chunk"` turns an unknown/expired
   * 422 (or a 404) into `uploadExpired`. An init 422 means size/type, and must
   * stay a plain validation error showing the server's message.
   */
  context?: "upload-init" | "upload-chunk";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fallback copy (English, short). The UI prefers its translations.          */
/* ────────────────────────────────────────────────────────────────────────── */

export const SESSION_EXPIRED_COPY =
  "Your session expired, or your account isn't set up in Notifications yet.";

const FALLBACK_BY_KIND: Record<AnnouncementErrorKind, string> = {
  validation: "Please check the highlighted fields.",
  auth: SESSION_EXPIRED_COPY,
  forbidden: "You don't have permission to do that.",
  notFound: "That item no longer exists.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  network: "Can't reach the server. Check your connection and try again.",
  timeout: "The request took too long. Please try again.",
  server: "Something went wrong on the server. Please try again.",
  uploadExpired: "This upload expired on the server. Please upload the file again.",
  tooLarge: "That file is too large for the server to accept.",
  cancelled: "Cancelled.",
  unknown: "Something went wrong. Please try again.",
};

export function fallbackMessageFor(kind: AnnouncementErrorKind): string {
  return FALLBACK_BY_KIND[kind];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Small helpers                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function flattenFieldErrors(errors: unknown): {
  fieldErrors: Record<string, string[]>;
  details: string[];
} {
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

/** `Retry-After` is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: unknown, now: number = Date.now()): number | null {
  if (value === undefined || value === null) return null;
  const asNumber = toNumber(value);
  if (asNumber !== null) return asNumber > 0 ? Math.ceil(asNumber) : null;
  if (typeof value === "string") {
    const when = Date.parse(value);
    if (Number.isFinite(when)) {
      const seconds = Math.ceil((when - now) / 1000);
      return seconds > 0 ? seconds : null;
    }
  }
  return null;
}

/** Whether an unknown value is already a parsed `AnnouncementError`. */
export function isAnnouncementError(value: unknown): value is AnnouncementError {
  const r = asRecord(value);
  return (
    !!r &&
    typeof r.kind === "string" &&
    typeof r.message === "string" &&
    "fieldErrors" in r &&
    "retryAfterSeconds" in r
  );
}

/** First message for a form field, or null. */
export function fieldError(
  error: AnnouncementError | null | undefined,
  ...fields: string[]
): string | null {
  if (!error) return null;
  for (const f of fields) {
    const messages = error.fieldErrors[f];
    if (messages?.length) return messages[0];
  }
  return null;
}

/** Build an error for a failure the client detected itself (before any request). */
export function makeClientError(
  kind: AnnouncementErrorKind,
  message: string,
  extra: Partial<Pick<AnnouncementError, "code" | "fieldErrors" | "details" | "raw">> = {},
): AnnouncementError {
  const fieldErrors = extra.fieldErrors ?? {};
  return {
    kind,
    status: null,
    message,
    serverMessage: null,
    fieldErrors,
    details: extra.details ?? Object.values(fieldErrors).flat(),
    retryAfterSeconds: null,
    code: extra.code ?? null,
    raw: extra.raw ?? null,
  };
}

/** Mentions an upload the server no longer knows (expired, unknown, missing). */
const UPLOAD_GONE_RE = /(unknown|expired|invalid|not\s+found|no\s+such|does\s*n[o']?t\s+exist|missing|no longer)/i;

function looksLikeUnknownUpload(
  message: string | null,
  fieldErrors: Record<string, string[]>,
): boolean {
  if (Object.keys(fieldErrors).some((f) => /upload/i.test(f))) return true;
  return !!message && /upload/i.test(message) && UPLOAD_GONE_RE.test(message);
}

function kindFromStatus(status: number): AnnouncementErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 408 || status === 504) return "timeout";
  if (status === 413) return "tooLarge";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rateLimited";
  if (status >= 500) return "server";
  return "unknown";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The parser                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Turn any thrown value from the announcement services into a displayable
 * error. `fallback` is used only when the failure carried no message at all.
 */
export function parseAnnouncementError(
  err: unknown,
  fallback?: string,
  options: ParseErrorOptions = {},
): AnnouncementError {
  // Already parsed (a store rethrowing, a hook passing one along).
  if (isAnnouncementError(err)) return err;

  const base = (kind: AnnouncementErrorKind, extra: Partial<AnnouncementError> = {}): AnnouncementError => ({
    kind,
    status: null,
    message: fallback ?? FALLBACK_BY_KIND[kind],
    serverMessage: null,
    fieldErrors: {},
    details: [],
    retryAfterSeconds: null,
    code: null,
    raw: err,
    ...extra,
  });

  // ── Aborts ───────────────────────────────────────────────────────────────
  if (axios.isCancel(err)) return base("cancelled", { message: FALLBACK_BY_KIND.cancelled });

  if (!axios.isAxiosError(err)) {
    const name = asRecord(err)?.name;
    if (name === "AbortError") return base("cancelled", { message: FALLBACK_BY_KIND.cancelled });
    if (name === "TimeoutError") return base("timeout");
    // fetch() network failure (the keepalive cancel call, mostly).
    if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
      return base("network");
    }
    if (err instanceof Error && err.message === "Not logged in.") {
      return base("auth", { message: SESSION_EXPIRED_COPY });
    }
    if (err instanceof Error && err.message) return base("unknown", { message: err.message });
    return base("unknown");
  }

  const status = err.response?.status ?? null;

  // ── No response: network drop, timeout, abort ────────────────────────────
  if (status === null) {
    if (err.code === "ERR_CANCELED") return base("cancelled", { message: FALLBACK_BY_KIND.cancelled });
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") return base("timeout", { code: err.code });
    return base("network", { code: err.code ?? null });
  }

  // ── The server answered ──────────────────────────────────────────────────
  const data = asRecord(err.response?.data);
  const errorObj = asRecord(data?.error);
  const { fieldErrors, details } = flattenFieldErrors(data?.errors);

  const serverMessage =
    nonEmptyString(data?.message) ??
    nonEmptyString(errorObj?.message) ??
    (details.length > 0 ? details[0] : null);

  const code = nonEmptyString(errorObj?.code);
  const retryAfterSeconds =
    parseRetryAfter(err.response?.headers?.["retry-after"]) ??
    toNumber(errorObj?.retryAfter) ??
    toNumber(errorObj?.retry_after_seconds);

  let kind = kindFromStatus(status);

  // Our proxy says TIMEOUT with a 504; keep it a timeout even if the status
  // was rewritten on the way.
  if (code === "TIMEOUT") kind = "timeout";

  if (options.context === "upload-chunk") {
    if (
      (kind === "validation" && looksLikeUnknownUpload(serverMessage, fieldErrors)) ||
      // The route doesn't exist for a forgotten upload on some deployments.
      kind === "notFound"
    ) {
      kind = "uploadExpired";
    }
  }

  const message =
    kind === "auth"
      ? SESSION_EXPIRED_COPY
      : (serverMessage ?? fallback ?? FALLBACK_BY_KIND[kind]);

  return {
    kind,
    status,
    message,
    serverMessage,
    fieldErrors,
    details,
    retryAfterSeconds,
    code,
    raw: err,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Display helper                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * `t` from `useTranslations("announcements")`, or anything shaped like it. It
 * is a plain parameter so this file never calls a hook.
 */
export type ErrorTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * The text to show for an error.
 *
 *  - 401: our copy (the backend's "Unauthenticated." helps nobody).
 *  - kinds with no useful server text (network, timeout, cancelled,
 *    uploadExpired, tooLarge): the translation.
 *  - everything else: the backend's own message, verbatim.
 *  - a Retry-After on a 429: "Try again in {seconds}s".
 *
 * With no translator it returns `error.message` (English).
 */
export function describeAnnouncementError(
  error: AnnouncementError,
  t?: ErrorTranslator,
): string {
  if (!t) return error.message;

  switch (error.kind) {
    case "auth":
    case "network":
    case "timeout":
    case "cancelled":
    case "uploadExpired":
    case "unknown":
      return t(`errors.${error.kind}`);
    case "tooLarge":
      return error.serverMessage ?? t("errors.tooLarge");
    case "rateLimited":
      return error.retryAfterSeconds
        ? t("errors.rateLimitedIn", { seconds: error.retryAfterSeconds })
        : (error.serverMessage ?? t("errors.rateLimited"));
    default:
      return error.serverMessage ?? t(`errors.${error.kind}`);
  }
}
