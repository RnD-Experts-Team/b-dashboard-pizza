import axios from "axios";
import type { TicketStatus } from "@/types/toolbox-tickets.types";

/**
 * One normalised error for everything the Tickets API, our proxy, or the
 * network can produce. Four body shapes reach us:
 *
 *   1. Domain      { message, error: { code, ...context } }
 *   2. Validation  { message, errors: { field: [msg] } }            (Laravel 422)
 *   3. Not found   { message: "No query results for model [...]" }  (404, no code)
 *   4. Middleware  401 / 403 before the ticket code runs, plus our proxy's own
 *                  { success: false, error: { code, message } }     (400/502/504)
 *
 * Unlike Breaks, 403 is NOT folded into 404: on this API a 403 means "you can
 * see it, but not this action" (TICKET_FORBIDDEN names the ability). A 403
 * WITHOUT a code came from the pizzasys middleware — on the admin routes that's
 * the missing `administer tickets` permission; on ticket routes it means the
 * auth rules aren't seeded in this environment, which is not the user's fault.
 *
 * UI branches on `code` only. `message` is the server's own sentence, shown as-is.
 */

export const TICKET_DOMAIN_CODES = [
  "TICKET_FORBIDDEN",
  "TICKET_ILLEGAL_TRANSITION",
  "TICKET_ALREADY_IN_STATUS",
  "TICKET_NOT_REOPENABLE",
  "TICKET_REOPEN_REASON_REQUIRED",
  "TICKET_SECTION_INACTIVE",
  "TICKET_LEVEL_CYCLE",
  "TICKET_ASSIGNMENT_TARGET_REQUIRED",
  "TICKET_ASSIGNMENT_TARGET_AMBIGUOUS",
  "TICKET_ASSIGNMENT_DUPLICATE",
  "TICKET_PARTICIPANT_REDUNDANT",
  "STORE_NOT_FOUND",
] as const;
export type TicketDomainErrorCode = (typeof TICKET_DOMAIN_CODES)[number];

export type TicketClientErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "NOT_AUTHENTICATED"
  /** Plain 403 on an admin route — missing `administer tickets`. */
  | "ADMIN_FORBIDDEN"
  /** Plain 403 on a ticket route — pizzasys auth rules not seeded. */
  | "ENV_FORBIDDEN"
  | "NO_STORE"
  | "BAD_REQUEST"
  | "TIMEOUT"
  | "NETWORK"
  | "SERVER"
  | "CANCELLED"
  | "UNKNOWN";

export type TicketErrorCode = TicketDomainErrorCode | TicketClientErrorCode;

export type TicketErrorScope = "ticket" | "admin";

const DOMAIN_SET: ReadonlySet<string> = new Set(TICKET_DOMAIN_CODES);

export class TicketError extends Error {
  readonly code: TicketErrorCode;
  readonly status: number | null;
  /** Laravel field errors, first message per field (incl. `files.0`). */
  readonly fieldErrors: Record<string, string>;
  /** TICKET_FORBIDDEN */
  readonly ability?: string;
  readonly role?: string;
  /** TICKET_ILLEGAL_TRANSITION — the buttons that WOULD work. */
  readonly allowed?: TicketStatus[];
  /** TICKET_LEVEL_CYCLE */
  readonly path?: unknown[];
  /** TICKET_SECTION_INACTIVE */
  readonly sectionKey?: string;
  /** STORE_NOT_FOUND */
  readonly storeNumber?: string;

  constructor(init: {
    code: TicketErrorCode;
    message: string;
    status?: number | null;
    fieldErrors?: Record<string, string>;
    ability?: string;
    role?: string;
    allowed?: TicketStatus[];
    path?: unknown[];
    sectionKey?: string;
    storeNumber?: string;
  }) {
    super(init.message);
    this.name = "TicketError";
    this.code = init.code;
    this.status = init.status ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.ability = init.ability;
    this.role = init.role;
    this.allowed = init.allowed;
    this.path = init.path;
    this.sectionKey = init.sectionKey;
    this.storeNumber = init.storeNumber;
  }

  /** Transport-level failures a plain retry can fix. Never auto-retried. */
  get retryable(): boolean {
    return ["TIMEOUT", "NETWORK", "SERVER"].includes(this.code);
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

function firstMessages(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== "object") return out;
  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    const msg = Array.isArray(value) ? value[0] : value;
    if (typeof msg === "string") out[field] = msg;
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export function parseTicketError(err: unknown, scope: TicketErrorScope = "ticket"): TicketError {
  if (err instanceof TicketError) return err;

  if (axios.isCancel(err) || (axios.isAxiosError(err) && err.code === "ERR_CANCELED")) {
    return new TicketError({ code: "CANCELLED", message: "Request cancelled." });
  }

  if (!axios.isAxiosError(err)) {
    return new TicketError({
      code: "UNKNOWN",
      message: err instanceof Error ? err.message : "Something went wrong.",
    });
  }

  if (err.code === "ECONNABORTED" || /timeout/i.test(err.message)) {
    return new TicketError({ code: "TIMEOUT", message: "The request timed out." });
  }

  const status = err.response?.status ?? null;
  const data = (err.response?.data ?? {}) as Record<string, unknown>;
  const block =
    data.error && typeof data.error === "object" ? (data.error as Record<string, unknown>) : null;
  const message =
    str(data.message) || str(block?.message) || err.message || "Something went wrong.";

  if (!err.response) {
    return new TicketError({ code: "NETWORK", message, status });
  }

  // 1. Domain error — code-keyed, with context.
  const rawCode = str(block?.code) ?? null;
  if (rawCode && DOMAIN_SET.has(rawCode)) {
    return new TicketError({
      code: rawCode as TicketDomainErrorCode,
      message,
      status,
      fieldErrors: firstMessages(data.errors),
      ability: str(block?.ability),
      role: str(block?.role),
      allowed: Array.isArray(block?.allowed) ? (block.allowed as TicketStatus[]) : undefined,
      path: Array.isArray(block?.path) ? (block.path as unknown[]) : undefined,
      sectionKey: str(block?.section_key),
      storeNumber: str(block?.store_number),
    });
  }

  // 2. Laravel validation — field-keyed.
  if (status === 422 || data.errors) {
    return new TicketError({
      code: "VALIDATION",
      message,
      status,
      fieldErrors: firstMessages(data.errors),
    });
  }

  if (status === 401) return new TicketError({ code: "NOT_AUTHENTICATED", message, status });
  // 3. 404 = "not yours or not here" — never "deleted".
  if (status === 404) return new TicketError({ code: "NOT_FOUND", message, status });
  // 4. Middleware 403 (no code).
  if (status === 403) {
    return new TicketError({
      code: scope === "admin" ? "ADMIN_FORBIDDEN" : "ENV_FORBIDDEN",
      message,
      status,
    });
  }
  if (status === 400) return new TicketError({ code: "BAD_REQUEST", message, status });
  if (status === 504 || rawCode === "TIMEOUT") return new TicketError({ code: "TIMEOUT", message, status });
  if (status === 502 && rawCode === "UPSTREAM_ERROR") return new TicketError({ code: "NETWORK", message, status });
  if ((status ?? 0) >= 500) return new TicketError({ code: "SERVER", message, status });

  return new TicketError({ code: "UNKNOWN", message, status });
}

/** Which form field a domain code belongs to, so it renders inline. */
export function fieldForCode(code: TicketErrorCode): string | null {
  switch (code) {
    case "TICKET_SECTION_INACTIVE":
      return "section_key";
    case "TICKET_REOPEN_REASON_REQUIRED":
      return "reason";
    case "TICKET_LEVEL_CYCLE":
      return "parent_id";
    case "TICKET_PARTICIPANT_REDUNDANT":
      return "user_id";
    case "TICKET_ASSIGNMENT_TARGET_REQUIRED":
    case "TICKET_ASSIGNMENT_TARGET_AMBIGUOUS":
      return "target";
    default:
      return null;
  }
}

/**
 * Field errors with any domain code folded in under its field — the one call
 * a form needs. Keys stay the API's snake_case (`title`, `files.0`, …).
 */
export function formErrors(err: TicketError): Record<string, string> {
  const out = { ...err.fieldErrors };
  const field = fieldForCode(err.code);
  if (field && !out[field]) out[field] = err.message;
  // The two "exactly one target" errors can arrive as Laravel bodies on either field.
  if (out.ticket_section_id || out.ticket_level_id) {
    out.target = out.target ?? out.ticket_section_id ?? out.ticket_level_id;
  }
  return out;
}

/** Card-level category for list/detail failures. */
export type TicketErrorKind =
  | "notFound"
  | "storeUnknown"
  | "noStore"
  | "envForbidden"
  | "adminForbidden"
  | "auth"
  | "network"
  | "timeout"
  | "server"
  | "generic";

export function errorKind(err: TicketError): TicketErrorKind {
  switch (err.code) {
    case "NOT_FOUND":
      return "notFound";
    case "STORE_NOT_FOUND":
      return "storeUnknown";
    case "NO_STORE":
      return "noStore";
    case "ENV_FORBIDDEN":
      return "envForbidden";
    case "ADMIN_FORBIDDEN":
      return "adminForbidden";
    case "NOT_AUTHENTICATED":
      return "auth";
    case "NETWORK":
      return "network";
    case "TIMEOUT":
      return "timeout";
    case "SERVER":
      return "server";
    default:
      return "generic";
  }
}
