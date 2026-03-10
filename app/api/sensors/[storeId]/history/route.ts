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
/*  GET /api/sensors/:storeId/history                                       */
/*  → upstream /api/stores/:storeId/reports/history?from=&to=&per_page=     */
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
    const from = sp.get("from") || "";
    const to = sp.get("to") || "";
    const perPage = sp.get("per_page") || "20";
    const deviceType = sp.get("device_type") || "";
    const page = sp.get("page") || "";

    if (from && !isValidDate(from)) return errorResponse("INVALID_PARAM", "Invalid from date", 400);
    if (to && !isValidDate(to)) return errorResponse("INVALID_PARAM", "Invalid to date", 400);

    // Build upstream query — forward all valid params
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    qs.set("per_page", perPage);
    if (deviceType) qs.set("device_type", deviceType);
    if (page) qs.set("page", page);

    const upstreamAuth = SENSORS_API_TOKEN
      ? `Bearer ${SENSORS_API_TOKEN}`
      : getAuthorizationHeader(request)!;

    const upstreamUrl = `${SENSORS_BASE_URL}/stores/${encodeURIComponent(storeId)}/reports/history?${qs}`;

    const upstream = await fetchWithRetry(upstreamUrl, {
      method: "GET",
      headers: { Authorization: upstreamAuth, Accept: "application/json" },
    });

    const body = await upstream.json();
    if (!upstream.ok) {
      const s = upstream.status;
      if (s === 401) return errorResponse("UNAUTHORIZED", "Authentication failed", 401);
      if (s === 403) return errorResponse("FORBIDDEN", "Access denied", 403);
      if (s === 404) return errorResponse("NOT_FOUND", "History not found", 404);
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
    console.error("[sensors/history] proxy error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
