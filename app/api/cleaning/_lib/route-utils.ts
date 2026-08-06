import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                             */
/*                                                                            */
/*  All cleaning endpoints proxy to the AuditApp/QA backend under /cleaning.  */
/*  Base = QA_API_URL (server-only override) || NEXT_PUBLIC_QA_API_URL.       */
/* ────────────────────────────────────────────────────────────────────────── */

const QA_BASE_URL = (
  process.env.QA_API_URL ||
  process.env.NEXT_PUBLIC_QA_API_URL ||
  "https://qa.lcportal.cloud/api"
).replace(/\/+$/, "");

/** Root for every cleaning call, e.g. `${CLEANING_BASE_URL}/tasks` */
export const CLEANING_BASE_URL = `${QA_BASE_URL}/cleaning`;

const QA_API_TOKEN = process.env.QA_API_TOKEN;
export const UPSTREAM_TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS) || 15_000;
export const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Errors                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type ErrorCode =
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status, headers: JSON_HEADERS }
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Auth                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export { requireAuthorization };

/** Prefer a server-only token if configured; else forward the client token. */
export function upstreamAuth(request: NextRequest): string {
  return QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : getAuthorizationHeader(request) ?? "";
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fetch utilities                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      // Retry only on 5xx / network; never on 4xx.
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastError = new Error(`Upstream ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError")
        lastError = new Error("Upstream request timed out");
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error("All retries exhausted");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Header builders                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export function jsonHeaders(request: NextRequest): HeadersInit {
  const auth = upstreamAuth(request);
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(auth && { Authorization: auth }),
  };
}

export function getHeaders(request: NextRequest): HeadersInit {
  const auth = upstreamAuth(request);
  return {
    Accept: "application/json",
    ...(auth && { Authorization: auth }),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Response mappers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function mapUpstreamError(status: number, rawText: string): NextResponse {
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
  }
  const upstreamMessage =
    (parsed?.message as string | undefined) ??
    ((parsed?.error as { message?: string } | undefined)?.message);

  switch (status) {
    case 401:
      return errorResponse(
        "UNAUTHORIZED",
        upstreamMessage || "Authentication failed for the cleaning API.",
        401,
        parsed ? { upstream: parsed } : undefined
      );
    case 403:
      return errorResponse(
        "FORBIDDEN",
        upstreamMessage || "You do not have permission to perform this action.",
        403
      );
    case 404:
      return errorResponse(
        "NOT_FOUND",
        upstreamMessage || "The requested resource was not found.",
        404
      );
    case 422:
      return errorResponse(
        "VALIDATION_ERROR",
        upstreamMessage || "Validation failed.",
        422,
        parsed ? { upstream: parsed } : undefined
      );
    case 429:
      return errorResponse(
        "RATE_LIMITED",
        upstreamMessage || "Too many requests. Please wait before trying again.",
        429
      );
    default:
      // Preserve the real upstream message (e.g. Laravel's "The DELETE method
      // is not supported for this route…" on a 405, or an exception message on
      // a 500) instead of a generic "(status)." — that text is what actually
      // explains the failure and needs to reach the toast, not just dev logs.
      return errorResponse(
        "UPSTREAM_ERROR",
        upstreamMessage || `The cleaning API returned an error (${status}).`,
        // 5xx from upstream → genuinely a bad gateway. 4xx we didn't special-case
        // (e.g. 400/405/409) → pass the real status through so it isn't
        // misreported as a gateway problem.
        status >= 500 ? 502 : status,
        { upstreamStatus: status, upstreamMessage, upstream: parsed }
      );
  }
}

function mapCatch(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.includes("timed out") || message.includes("abort")) {
    return errorResponse(
      "TIMEOUT",
      `The cleaning API did not respond within ${UPSTREAM_TIMEOUT_MS / 1_000}s. Please try again.`,
      504
    );
  }
  return errorResponse(
    "NETWORK_ERROR",
    "Unable to reach the cleaning API. Please check your connection and try again.",
    503
  );
}

/**
 * Forward a request to the cleaning backend and return a JSON NextResponse.
 * Passes through successful bodies verbatim; maps errors to the standard shape.
 */
export async function forwardJson(
  targetUrl: string,
  init: RequestInit
): Promise<NextResponse> {
  try {
    const response = await fetchWithRetry(targetUrl, init);
    const text = await response.text();
    if (response.ok) {
      // validate JSON (empty body → wrap as {data:null})
      if (!text.trim()) {
        return new NextResponse(JSON.stringify({ data: null }), {
          status: response.status,
          headers: JSON_HEADERS,
        });
      }
      try {
        JSON.parse(text);
      } catch {
        return errorResponse("UPSTREAM_ERROR", "Upstream returned invalid JSON.", 502);
      }
      return new NextResponse(text, {
        status: response.status,
        headers: JSON_HEADERS,
      });
    }
    return mapUpstreamError(response.status, text);
  } catch (error) {
    return mapCatch(error);
  }
}
