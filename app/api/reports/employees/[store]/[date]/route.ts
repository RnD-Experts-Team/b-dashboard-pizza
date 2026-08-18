import { NextRequest, NextResponse } from "next/server";
import {
  getAuthorizationHeader,
  requireAuthorization,
} from "@/app/api/_lib/auth";

/**
 * GET /api/reports/employees/[store]/[date]?trend_weeks=N
 * Proxy → GET {DATA_API_URL}/reports/employees/{store}/{date}?trend_weeks=N
 *
 * Same DATA_API_URL family and structural pattern as
 * app/api/data/stores/[storeId]/employee-debriefs/route.ts (the closest
 * sibling — same upstream, same employee domain).
 */

const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const DATA_API_TOKEN = process.env.DATA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.DATA_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

// This endpoint's own documented range — distinct from the labor report's
// 4–12 (see app/api/hiring-management/[storeId]/labor/[date]/route.ts).
const TREND_WEEKS_DEFAULT = 6;
const TREND_WEEKS_MIN = 1;
const TREND_WEEKS_MAX = 12;

const STORE_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(d);
}

type ErrorCode =
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
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
  retries: number,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      // Only retry on 5xx/network failures — a 4xx won't change on retry.
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`Upstream ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        lastError = new Error("Upstream request timed out");
      }
    }

    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_MS * Math.pow(2, attempt)),
      );
    }
  }
  throw lastError ?? new Error("All retries exhausted");
}

function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

async function handleUpstreamError(response: Response) {
  if (response.status === 401) {
    return errorResponse("UNAUTHORIZED", "Authentication failed for Data API.", 401);
  }
  if (response.status === 403) {
    return errorResponse(
      "FORBIDDEN",
      "You do not have permission to access this resource.",
      403,
    );
  }
  if (response.status === 404) {
    return errorResponse("NOT_FOUND", "Employee report was not found for this store/week.", 404);
  }
  if (response.status === 422) {
    let body: Record<string, unknown> = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    return errorResponse(
      "VALIDATION_ERROR",
      (body?.message as string) || "Validation failed.",
      422,
      { errors: body?.errors },
    );
  }
  if (response.status === 429) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
  }
  return errorResponse(
    "UPSTREAM_ERROR",
    `Data API returned an error (${response.status}).`,
    502,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ store: string; date: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { store, date } = await params;

  if (!store?.trim() || !STORE_RE.test(store)) {
    return errorResponse("VALIDATION_ERROR", "store is required.", 422, { param: "store" });
  }
  if (!isValidDate(date)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "date must be in YYYY-MM-DD format.",
      422,
      { param: "date" },
    );
  }

  const rawTrendWeeks = request.nextUrl.searchParams.get("trend_weeks");
  const parsed = rawTrendWeeks === null ? NaN : Number.parseInt(rawTrendWeeks, 10);
  const trendWeeks = Number.isFinite(parsed)
    ? Math.min(TREND_WEEKS_MAX, Math.max(TREND_WEEKS_MIN, parsed))
    : TREND_WEEKS_DEFAULT;

  const targetUrl =
    `${DATA_BASE_URL}/reports/employees/${encodeURIComponent(store)}/${encodeURIComponent(date)}` +
    `?trend_weeks=${trendWeeks}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: getUpstreamAuth(request) },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES,
    );

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return await handleUpstreamError(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}
