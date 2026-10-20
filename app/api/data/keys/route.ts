import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  isRetryableStatus,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const DATA_API_TOKEN = process.env.DATA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.DATA_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error helpers                                                           */
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
  | "VALIDATION_ERROR"
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
/*  Fetch utilities                                                         */
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
      if (!isRetryableStatus(res.status)) return res;
      lastError = new Error(`Upstream ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError")
        lastError = new Error("Upstream request timed out");
    }
    if (attempt < retries) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt))
      );
    }
  }
  throw lastError ?? new Error("All retries exhausted");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Upstream helpers                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

function handleUpstreamError(response: Response, elapsed: number) {
  if (response.status === 401) {
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication failed for the Data API.",
      401,
      { upstream: true, tokenConfigured: !!DATA_API_TOKEN }
    );
  }
  if (response.status === 403) {
    return errorResponse(
      "FORBIDDEN",
      "You do not have permission to access this resource.",
      403
    );
  }
  if (response.status === 404) {
    return errorResponse("NOT_FOUND", "The requested resource was not found.", 404);
  }
  if (response.status === 422) {
    return response.json().then((body) =>
      errorResponse("VALIDATION_ERROR", body?.message || "Validation error.", 422, {
        errors: body?.errors,
      })
    );
  }
  if (response.status === 429) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
  }
  return errorResponse(
    "UPSTREAM_ERROR",
    `Data API returned an error (${response.status}).`,
    502,
    process.env.NODE_ENV === "development"
      ? { upstreamStatus: response.status }
      : undefined
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET /api/data/keys?page=1                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;

  if (pageParam !== null && (!Number.isFinite(page) || page < 1)) {
    return errorResponse("INVALID_PARAM", "Page must be a positive integer", 400, {
      param: "page",
    });
  }

  const tagsParam = searchParams.get("tags");
  if (tagsParam !== null && tagsParam.trim() !== "") {
    if (!/^(\d+,)*\d+$/.test(tagsParam.trim())) {
      return errorResponse("INVALID_PARAM", "tags must be comma-separated integers", 400, { param: "tags" });
    }
  }

  const upstreamParams = new URLSearchParams();
  upstreamParams.set("page", String(page));
  if (tagsParam && tagsParam.trim()) {
    upstreamParams.set("tags", tagsParam.trim());
  }

  const targetUrl = `${DATA_BASE_URL}/engine/keys?${upstreamParams.toString()}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const body = await response.text();
      try {
        JSON.parse(body);
      } catch {
        return errorResponse("UPSTREAM_ERROR", "Upstream returned invalid JSON", 502);
      }
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    return await handleUpstreamError(response, elapsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/data/keys — create a key                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON body", 400);
  }

  const targetUrl = `${DATA_BASE_URL}/engine/keys`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
        body: JSON.stringify(body),
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const responseBody = await response.text();
      try {
        JSON.parse(responseBody);
      } catch {
        return errorResponse("UPSTREAM_ERROR", "Upstream returned invalid JSON", 502);
      }
      return new NextResponse(responseBody, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    return await handleUpstreamError(response, elapsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}
