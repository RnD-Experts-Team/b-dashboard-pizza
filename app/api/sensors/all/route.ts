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

const UPSTREAM_TIMEOUT_MS =
  Number(process.env.SENSORS_TIMEOUT_MS) || 30_000;

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error helper                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fetch with retry + exponential back-off                                 */
/* ────────────────────────────────────────────────────────────────────────── */

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
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
/*  GET /api/sensors/all  →  upstream GET /stores/sensors (all active)      */
/*  Omitting store_ids returns all active stores per the API contract.      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const authError = requireAuthorization(request);
    if (authError) return authError;

    const upstreamAuth = SENSORS_API_TOKEN
      ? `Bearer ${SENSORS_API_TOKEN}`
      : getAuthorizationHeader(request)!;

    const unit = request.nextUrl.searchParams.get("unit");
    const upstreamUrl = unit
      ? `${SENSORS_BASE_URL}/stores/sensors?unit=${unit}`
      : `${SENSORS_BASE_URL}/stores/sensors`;

    const upstream = await fetchWithRetry(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: upstreamAuth,
        Accept: "application/json",
      },
    });

    const body = await upstream.json();

    if (!upstream.ok) {
      const status = upstream.status;
      if (status === 401) return errorResponse("UNAUTHORIZED", "Authentication failed", 401);
      if (status === 403) return errorResponse("FORBIDDEN", "Access denied", 403);
      if (status === 404) return errorResponse("NOT_FOUND", "No stores found", 404);
      if (status === 429) return errorResponse("RATE_LIMITED", "Too many requests", 429);
      return errorResponse("UPSTREAM_ERROR", body?.message || "Upstream error", status);
    }

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=60, max-age=30, stale-while-revalidate=120" },
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    console.error("[sensors/all] proxy error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
  }
}
