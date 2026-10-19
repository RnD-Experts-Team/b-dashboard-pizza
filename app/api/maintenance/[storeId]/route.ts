import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  isRetryableStatus,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const MAINTENANCE_BASE_URL =
  process.env.MAINTENANCE_API_URL ||
  process.env.NEXT_PUBLIC_MAINTENANCE_API_URL ||
  "https://attend.pnepizza.com/api";

/**
 * Server-side only Maintenance API token.
 * When set, this token is used instead of forwarding the client's auth token.
 */
const MAINTENANCE_API_TOKEN = process.env.MAINTENANCE_API_TOKEN;

/** Upstream request timeout in ms (default 15 s) */
const UPSTREAM_TIMEOUT_MS =
  Number(process.env.MAINTENANCE_TIMEOUT_MS) || 15_000;

/** Max retries on 5xx / network errors */
const MAX_RETRIES = 2;

/** Base delay between retries (exponential back-off) */
const RETRY_BASE_MS = 500;



/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation helpers                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

// Store IDs follow the pattern "XXXXX-XXXXX" (e.g., "03795-00001")
const STORE_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;

function isValidStoreId(id: string): boolean {
  return STORE_ID_RE.test(id);
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
        "Cache-Control": "no-store",
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
      if (!isRetryableStatus(res.status)) {
        return res;
      }

      lastError = new Error(`Upstream ${res.status}`);
      console.warn(
        `⚠️  Maintenance Proxy: attempt ${attempt + 1}/${retries + 1} failed (${res.status})`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (lastError.name === "AbortError") {
        lastError = new Error("Upstream request timed out");
      }

      console.warn(
        `⚠️  Maintenance Proxy: attempt ${attempt + 1}/${retries + 1} error:`,
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
 * GET /api/maintenance/{storeId}?page=N
 *
 * Proxy to the upstream Maintenance API at attend.pnepizza.com.
 * Features:
 *  - Input validation & sanitisation
 *  - Structured error responses with error codes
 *  - Automatic retries with exponential back-off on 5xx / network errors
 *  - Configurable timeout (MAINTENANCE_TIMEOUT_MS env)
 *  - Cache headers for successful responses
 *  - Dedicated server-side MAINTENANCE_API_TOKEN support
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const startTime = Date.now();

  // ── Auth check ───────────────────────────────────────────────────────
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // ── Extract & validate params ────────────────────────────────────────
  const { storeId } = await params;
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (!storeId) {
    return errorResponse("MISSING_PARAM", "Store ID is required", 400);
  }
  if (!isValidStoreId(storeId)) {
    return errorResponse(
      "INVALID_PARAM",
      "Store ID must be 1-32 alphanumeric characters, hyphens, or underscores",
      400,
      {
        param: "storeId",
        ...(process.env.NODE_ENV === "development" && { received: storeId }),
      }
    );
  }
  if (pageParam !== null && (!Number.isFinite(page) || page < 1)) {
    return errorResponse(
      "INVALID_PARAM",
      "Page must be a positive integer",
      400,
      {
        param: "page",
        ...(process.env.NODE_ENV === "development" && { received: pageParam }),
      }
    );
  }
  if (limitParam !== null && (!Number.isFinite(limit!) || limit! < 1 || limit! > 100)) {
    return errorResponse(
      "INVALID_PARAM",
      "Limit must be a positive integer between 1 and 100",
      400,
      {
        param: "limit",
        ...(process.env.NODE_ENV === "development" && { received: limitParam }),
      }
    );
  }

  // ── Build upstream request ───────────────────────────────────────────
  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = MAINTENANCE_API_TOKEN
    ? `Bearer ${MAINTENANCE_API_TOKEN}`
    : authorization ?? "";

  const targetUrl = `${MAINTENANCE_BASE_URL}/stores/${encodeURIComponent(storeId)}/maintenance-requests?page=${page}${limit ? `&limit=${limit}` : ''}`;

  console.log(
    `🔧 Maintenance Proxy → ${targetUrl}`,
    MAINTENANCE_API_TOKEN ? "(server token)" : "(client token)"
  );

  // ── Fetch upstream ───────────────────────────────────────────────────
  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;
    console.log(`🔧 Maintenance Proxy ← ${response.status} (${elapsed}ms)`);

    // ── Success ──────────────────────────────────────────────────────
    if (response.ok) {
      const body = await response.text();

      // Validate upstream returned valid JSON
      try {
        JSON.parse(body);
      } catch {
        return errorResponse(
          "UPSTREAM_ERROR",
          "Upstream returned invalid JSON",
          502,
          { upstreamStatus: response.status }
        );
      }

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Cache 2 min browser, 5 min CDN, stale-while-revalidate 10 min
          "Cache-Control":
            "public, s-maxage=300, max-age=120, stale-while-revalidate=600",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    // ── 401 — auth issue ───────────────────────────────────────────
    if (response.status === 401) {
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication failed for the Maintenance API.",
        401,
        { upstream: true, tokenConfigured: !!MAINTENANCE_API_TOKEN }
      );
    }

    // ── 403 — forbidden ────────────────────────────────────────────
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to access this store's maintenance requests.",
        403,
        { storeId }
      );
    }

    // ── 404 — no data for this store ───────────────────────────────
    if (response.status === 404) {
      return errorResponse(
        "NOT_FOUND",
        `No maintenance data found for store ${storeId}.`,
        404,
        { storeId }
      );
    }

    // ── 429 — rate limited ─────────────────────────────────────────
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
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
      `Maintenance server returned an error (${response.status}).`,
      502,
      {
        upstreamStatus: response.status,
        ...(process.env.NODE_ENV === "development" &&
          upstreamBody && { upstreamMessage: upstreamBody.slice(0, 500) }),
      }
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : "Unknown network error";

    console.error(`❌ Maintenance Proxy error (${elapsed}ms):`, message);

    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse(
        "TIMEOUT",
        `The Maintenance server did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try again.`,
        504,
        { timeoutMs: UPSTREAM_TIMEOUT_MS, elapsed }
      );
    }

    return errorResponse(
      "NETWORK_ERROR",
      "Unable to reach the Maintenance server. Please check your connection and try again.",
      503,
      { elapsed }
    );
  }
}
