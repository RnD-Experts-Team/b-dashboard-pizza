import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const SENSORS_BASE_URL =
  process.env.SENSORS_API_URL ||
  process.env.NEXT_PUBLIC_SENSORS_API_URL ||
  "https://sensors.pnefoods.com/api";

const SENSORS_API_TOKEN = process.env.SENSORS_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.SENSORS_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

const STORE_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const VALID_PERIODS = ["daily", "weekly", "monthly"] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
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
  | "INTERNAL_ERROR";

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

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET /api/sensors/:storeId/reports                                       */
/*  → upstream /api/stores/:storeId/reports?period=&date=&device_id=&fields=*/
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  try {
    const authError = requireAuthorization(request);
    if (authError) return authError;

    const { storeId } = await params;
    if (!STORE_ID_RE.test(storeId)) {
      return errorResponse("INVALID_PARAM", "Invalid store ID format", 400);
    }

    const sp = request.nextUrl.searchParams;
    const period = sp.get("period") || "daily";
    const date = sp.get("date") || "";
    const deviceId = sp.get("device_id") || "";
    const fields = sp.get("fields") || "";

    // Validate period is one of the allowed values
    if (!VALID_PERIODS.includes(period as typeof VALID_PERIODS[number])) {
      return errorResponse("INVALID_PARAM", "Invalid period. Must be daily, weekly, or monthly.", 400);
    }
    if (date && !isValidDate(date)) {
      return errorResponse("INVALID_PARAM", "Invalid date format (YYYY-MM-DD)", 400);
    }

    // Build query string for upstream — only include provided params
    const qs = new URLSearchParams();
    qs.set("period", period);
    if (date) qs.set("date", date);
    if (deviceId) qs.set("device_id", deviceId);
    if (fields) qs.set("fields", fields);

    const upstreamAuth = SENSORS_API_TOKEN
      ? `Bearer ${SENSORS_API_TOKEN}`
      : getAuthorizationHeader(request)!;

    const upstreamUrl = `${SENSORS_BASE_URL}/stores/${encodeURIComponent(storeId)}/reports?${qs}`;

    const upstream = await fetchWithRetry(upstreamUrl, {
      method: "GET",
      headers: { Authorization: upstreamAuth, Accept: "application/json" },
    });

    const body = await upstream.json();
    if (!upstream.ok) {
      const s = upstream.status;
      if (s === 401) return errorResponse("UNAUTHORIZED", "Authentication failed", 401);
      if (s === 403) return errorResponse("FORBIDDEN", "Access denied", 403);
      if (s === 404) return errorResponse("NOT_FOUND", "Reports not found", 404);
      if (s === 429) return errorResponse("RATE_LIMITED", "Too many requests", 429);
      return errorResponse("UPSTREAM_ERROR", body?.message || "Upstream error", s);
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=60, max-age=30, stale-while-revalidate=120" },
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    console.error("[sensors/reports] proxy error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
