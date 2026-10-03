import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                             */
/*                                                                            */
/*  Dough & Sauce spans three backends (contract §1). Two are proxied here:   */
/*    audit → AuditApp/QA   (QA_API_URL)    buffer · plan · judgement · weeks */
/*    data  → LC_PIZZA_DATA (DATA_API_URL)  base · recipes                    */
/*  The third (inventory counts) goes through app/api/inventory/_lib/proxy.   */
/* ────────────────────────────────────────────────────────────────────────── */

export const AUDIT_BASE_URL = (
  process.env.QA_API_URL ||
  process.env.NEXT_PUBLIC_QA_API_URL ||
  "https://qa.lcportal.cloud/api"
).replace(/\/+$/, "");

export const DATA_BASE_URL = (
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api"
).replace(/\/+$/, "");

export type DoughSauceSystem = "audit" | "data";

const SYSTEM_LABEL: Record<DoughSauceSystem, string> = {
  audit: "AuditApp",
  data: "LC_PIZZA_DATA",
};

const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

/** Store text key, e.g. "03795-00001" — never the numeric id (contract §3.1). */
const STORE_KEY_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const NUMERIC_ID_RE = /^\d+$/;

export { requireAuthorization };

/* ────────────────────────────────────────────────────────────────────────── */
/*  Errors                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

type ErrorCode =
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR";

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

/** Returns an error response for a malformed store key, or null when valid. */
export function invalidStoreKey(storeId: string) {
  return STORE_KEY_RE.test(storeId)
    ? null
    : errorResponse("INVALID_PARAM", "Store key is malformed.", 400);
}

export function invalidNumericId(id: string, label: string) {
  return NUMERIC_ID_RE.test(id)
    ? null
    : errorResponse("INVALID_PARAM", `${label} must be numeric.`, 400);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Forwarding                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function upstreamHeaders(request: NextRequest, withBody: boolean): HeadersInit {
  const auth = getAuthorizationHeader(request);
  return {
    Accept: "application/json",
    ...(withBody && { "Content-Type": "application/json" }),
    ...(auth && { Authorization: auth }),
  };
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  // Mutations are never retried — a 5xx after the write committed would
  // otherwise double-apply it.
  const retries = init.method && init.method !== "GET" ? 0 : MAX_RETRIES;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status < 500 || attempt === retries) return res;
      lastError = new Error(`Upstream ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") lastError = new Error("Upstream request timed out");
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
    }
  }
  throw lastError ?? new Error("All retries exhausted");
}

function mapUpstreamError(
  system: DoughSauceSystem,
  status: number,
  rawText: string
): NextResponse {
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    /* non-JSON body */
  }
  const label = SYSTEM_LABEL[system];
  const upstreamMessage =
    (parsed?.message as string | undefined) ??
    (parsed?.error as { message?: string } | undefined)?.message;
  const details = { system, upstreamStatus: status, ...(parsed && { upstream: parsed }) };

  switch (status) {
    case 401:
      return errorResponse("UNAUTHORIZED", upstreamMessage || `${label} rejected the token.`, 401, details);
    case 403:
      return errorResponse("FORBIDDEN", upstreamMessage || `${label} denied this action.`, 403, details);
    case 404:
      return errorResponse("NOT_FOUND", upstreamMessage || `${label}: not found.`, 404, details);
    case 422:
      return errorResponse("VALIDATION_ERROR", upstreamMessage || "Validation failed.", 422, details);
    case 429:
      return errorResponse("RATE_LIMITED", upstreamMessage || "Too many requests.", 429, details);
    default:
      return errorResponse(
        "UPSTREAM_ERROR",
        upstreamMessage || `${label} returned an error (${status}).`,
        status >= 500 ? 502 : status,
        details
      );
  }
}

/**
 * Forward a request to one Dough & Sauce backend. Successful bodies pass
 * through verbatim; failures map to the standard error envelope with
 * `details.system` so the client can tell WHICH of the three systems failed
 * (contract §9 — partial failure is normal).
 */
export async function forward(
  system: DoughSauceSystem,
  request: NextRequest,
  upstreamPath: string,
  method: "GET" | "POST" | "PUT" | "DELETE"
): Promise<NextResponse> {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const base = system === "audit" ? AUDIT_BASE_URL : DATA_BASE_URL;
  const url = `${base}${upstreamPath}${request.nextUrl.search}`;
  const withBody = method === "POST" || method === "PUT";
  const body = withBody ? await request.text() : undefined;

  try {
    const res = await fetchWithRetry(url, {
      method,
      headers: upstreamHeaders(request, withBody),
      ...(body !== undefined && { body }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) return mapUpstreamError(system, res.status, text);
    if (!text.trim()) {
      // A 204/205 can't carry a body (NextResponse throws) — report plain success instead.
      return new NextResponse(JSON.stringify({ data: null }), {
        status: res.status === 204 || res.status === 205 ? 200 : res.status,
        headers: JSON_HEADERS,
      });
    }
    try {
      JSON.parse(text);
    } catch {
      return errorResponse("UPSTREAM_ERROR", `${SYSTEM_LABEL[system]} returned invalid JSON.`, 502, { system });
    }
    return new NextResponse(text, { status: res.status, headers: JSON_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse(
        "TIMEOUT",
        `${SYSTEM_LABEL[system]} did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s.`,
        504,
        { system }
      );
    }
    return errorResponse("NETWORK_ERROR", `Unable to reach ${SYSTEM_LABEL[system]}.`, 503, { system });
  }
}
