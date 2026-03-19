import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

const MAINTENANCE_BASE_URL =
  process.env.MAINTENANCE_API_URL ||
  process.env.NEXT_PUBLIC_MAINTENANCE_API_URL ||
  "https://attend.pnepizza.com/api";

const MAINTENANCE_API_TOKEN = process.env.MAINTENANCE_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.MAINTENANCE_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;
const STORE_ID_HEADER_RE = /^[a-zA-Z0-9_-]{1,32}$/;

function getNormalizedStoreId(rawStoreId: string | null): string | null {
  if (!rawStoreId) return null;
  const normalized = rawStoreId.trim();
  return STORE_ID_HEADER_RE.test(normalized) ? normalized : null;
}

function errorResponse(
  code: string,
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

      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }

      lastError = new Error(`Upstream ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") {
        lastError = new Error("Upstream request timed out");
      }
    }

    if (attempt < retries) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt))
      );
    }
  }

  throw lastError ?? new Error("All retries exhausted");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { id } = await params;
  const requestId = Number(id);

  if (!id || !Number.isInteger(requestId) || requestId < 1) {
    return errorResponse(
      "INVALID_PARAM",
      "Maintenance request id must be a positive integer.",
      400,
      {
        param: "id",
        ...(process.env.NODE_ENV === "development" && { received: id }),
      }
    );
  }

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = MAINTENANCE_API_TOKEN
    ? `Bearer ${MAINTENANCE_API_TOKEN}`
    : authorization ?? "";
  const xStoreId = getNormalizedStoreId(request.headers.get("X-Store-Id"));

  const targetUrl = `${MAINTENANCE_BASE_URL}/maintenance-requests/${requestId}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
          ...(xStoreId && { "X-Store-Id": xStoreId }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    if (response.status === 401) {
      return errorResponse("UNAUTHORIZED", "Authentication failed.", 401);
    }
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to view this maintenance request.",
        403
      );
    }
    if (response.status === 404) {
      return errorResponse("NOT_FOUND", "Maintenance request not found.", 404);
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please wait before trying again.",
            ...(retryAfter && {
              retryAfter: Number(retryAfter) || retryAfter,
            }),
          },
        },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...(retryAfter && { "Retry-After": retryAfter }),
          },
        }
      );
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `Maintenance API returned an error (${response.status}).`,
      502,
      { upstreamStatus: response.status }
    );
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse(
        "TIMEOUT",
        `The Maintenance API did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s.`,
        504,
        { elapsed, timeoutMs: UPSTREAM_TIMEOUT_MS }
      );
    }

    return errorResponse(
      "NETWORK_ERROR",
      "Unable to reach the Maintenance API.",
      503,
      { elapsed }
    );
  }
}
