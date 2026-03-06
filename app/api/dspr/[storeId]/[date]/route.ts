import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const DSPR_BASE_URL =
  process.env.DSPR_API_URL ||
  process.env.NEXT_PUBLIC_DSPR_API_URL ||
  "https://data.lcportal.cloud/api/reports/dspr";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
  Vary: "Authorization, Cookie",
} as const;

/**
 * Server-side only DSPR API token.
 * When set, this token is used instead of forwarding the client's auth token.
 * Required because data.lcportal.cloud uses a separate auth system.
 */
const DSPR_API_TOKEN = process.env.DSPR_API_TOKEN;

/** Upstream request timeout in ms (default 15 s) */
const UPSTREAM_TIMEOUT_MS = Number(process.env.DSPR_TIMEOUT_MS) || 15_000;

/** Max retries on 5xx / network errors */
const MAX_RETRIES = 2;

/** Base delay between retries (exponential back-off) */
const RETRY_BASE_MS = 500;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation helpers                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const STORE_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidStoreId(id: string): boolean {
  return STORE_ID_RE.test(id);
}

function isValidDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return false;
  // Verify roundtrip — catches rolled-over dates like Feb 30 → Mar 1
  return parsed.toISOString().startsWith(d);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Structured error response                                               */
/* ────────────────────────────────────────────────────────────────────────── */

type ErrorCode =
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details && { details }) },
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...NO_CACHE_HEADERS,
      },
    }
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fetch with timeout + retry                                              */
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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);

      // Don't retry on client errors (4xx) — only on 5xx
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      // 5xx → retry
      lastError = new Error(`Upstream ${res.status}`);
      console.warn(
        `⚠️  DSPR Proxy: attempt ${attempt + 1}/${retries + 1} failed (${res.status})`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === "AbortError") {
        lastError = new Error("Upstream request timed out");
      }

      console.warn(
        `⚠️  DSPR Proxy: attempt ${attempt + 1}/${retries + 1} error:`,
        lastError.message
      );
    }

    // Exponential back-off before next retry
    if (attempt < retries) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt))
      );
    }
  }

  throw lastError ?? new Error("All retries exhausted");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET handler                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/dspr/{storeId}/{date}
 *
 * Production proxy to the upstream DSPR API at data.lcportal.cloud.
 * Features:
 *  - Input validation & sanitisation
 *  - Structured error responses with error codes
 *  - Automatic retries with exponential back-off on 5xx / network errors
 *  - Configurable timeout (DSPR_TIMEOUT_MS env)
 *  - Cache headers for successful responses
 *  - Dedicated server-side DSPR_API_TOKEN support
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; date: string }> }
) {
  const startTime = Date.now();

  // ── Auth check ───────────────────────────────────────────────────────
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // ── Extract & validate params ────────────────────────────────────────
  const { storeId, date } = await params;

  if (!storeId) {
    return errorResponse("MISSING_PARAM", "Store ID is required", 400);
  }
  if (!date) {
    return errorResponse("MISSING_PARAM", "Date is required", 400);
  }
  if (!isValidStoreId(storeId)) {
    return errorResponse(
      "INVALID_PARAM",
      "Store ID must be 1-32 alphanumeric characters, hyphens, or underscores",
      400,
      { param: "storeId", ...(process.env.NODE_ENV === "development" && { received: storeId }) }
    );
  }
  if (!isValidDate(date)) {
    return errorResponse(
      "INVALID_PARAM",
      "Date must be a valid YYYY-MM-DD format",
      400,
      { param: "date", ...(process.env.NODE_ENV === "development" && { received: date }) }
    );
  }

  // ── Build upstream request ───────────────────────────────────────────
  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = DSPR_API_TOKEN
    ? `Bearer ${DSPR_API_TOKEN}`
    : authorization ?? "";

  const targetUrl = `${DSPR_BASE_URL}/${encodeURIComponent(storeId)}/${encodeURIComponent(date)}`;

  console.log(
    `📊 DSPR Proxy → ${targetUrl}`,
    DSPR_API_TOKEN ? "(server token)" : "(client token)"
  );

  // ── Fetch upstream ───────────────────────────────────────────────────
  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: upstreamAuth,
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;
    console.log(`📊 DSPR Proxy ← ${response.status} (${elapsed}ms)`);

    // ── Success ──────────────────────────────────────────────────────
    if (response.ok) {
      const body = await response.text();

      // Validate upstream returned valid JSON
      let parsedBody: Record<string, unknown>;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        return errorResponse(
          "UPSTREAM_ERROR",
          "Upstream returned invalid JSON",
          502,
          { upstreamStatus: response.status }
        );
      }

      // Debug log: show key metrics from upstream response
      if (process.env.NODE_ENV === "development") {
        const d = parsedBody.day as Record<string, unknown> | undefined;
        console.log(
          `📊 DSPR Data: cash=$${d?.total_cash_sales ?? "?"}, customers=${d?.customer_count ?? "?"}, labor=${d?.labor ?? "?"}, tips=$${d?.total_tips ?? "?"}`
        );
      }

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...NO_CACHE_HEADERS,
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    // ── 401 — auth issue ───────────────────────────────────────────
    if (response.status === 401) {
      return errorResponse(
        "UNAUTHORIZED",
        DSPR_API_TOKEN
          ? "The DSPR API token is invalid or expired. Please contact your administrator to update the server configuration."
          : "The DSPR report service requires a dedicated API token that has not been configured. Please contact your administrator.",
        401,
        { upstream: true, tokenConfigured: !!DSPR_API_TOKEN }
      );
    }

    // ── 403 — forbidden ────────────────────────────────────────────
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to access this store's report.",
        403,
        { storeId }
      );
    }

    // ── 404 — no data for this store/date ──────────────────────────
    if (response.status === 404) {
      return errorResponse(
        "NOT_FOUND",
        `No report data found for store ${storeId} on ${date}.`,
        404,
        { storeId, date }
      );
    }

    // ── 429 — rate limited ─────────────────────────────────────────
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...NO_CACHE_HEADERS,
      };
      if (retryAfter) headers["Retry-After"] = retryAfter;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED" as ErrorCode,
            message: "Too many requests. Please wait before trying again.",
            ...(retryAfter && {
              retryAfter: Number(retryAfter) || retryAfter,
            }),
          },
        },
        { status: 429, headers }
      );
    }

    // ── Other upstream errors ──────────────────────────────────────
    let upstreamBody: string | null = null;
    try {
      upstreamBody = await response.text();
    } catch {
      /* ignore read errors */
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `DSPR server returned an error (${response.status}).`,
      502,
      {
        upstreamStatus: response.status,
        ...(process.env.NODE_ENV === "development" && upstreamBody && { upstreamMessage: upstreamBody.slice(0, 500) }),
      }
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : "Unknown network error";

    console.error(`❌ DSPR Proxy error (${elapsed}ms):`, message);

    // Distinguish timeout vs general network errors
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse(
        "TIMEOUT",
        `The DSPR server did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try again.`,
        504,
        { timeoutMs: UPSTREAM_TIMEOUT_MS, elapsed }
      );
    }

    return errorResponse(
      "NETWORK_ERROR",
      "Unable to reach the DSPR server. Please check your connection and try again.",
      503,
      { elapsed }
    );
  }
}
