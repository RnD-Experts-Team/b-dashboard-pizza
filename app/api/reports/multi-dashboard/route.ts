import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
  fetchWithTimeout,
} from "@/app/api/_lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * Upstream multi-store dashboard endpoint (the "database" base URL).
 * Derives from the DSPR base by swapping the trailing `/dspr` segment,
 * matching the convention in app/api/data/reports/dashboard/.../route.ts.
 */
const MULTI_DASHBOARD_URL =
  process.env.MULTI_DASHBOARD_API_URL ||
  process.env.DSPR_API_URL?.replace(/\/dspr$/, "/multi-dashboard") ||
  process.env.NEXT_PUBLIC_DSPR_API_URL?.replace(/\/dspr$/, "/multi-dashboard") ||
  "https://data.lcportal.cloud/api/reports/multi-dashboard";

/** Optional server-only token (shared with DSPR); falls back to client Bearer. */
const DASHBOARD_API_TOKEN =
  process.env.DASHBOARD_REPORT_API_TOKEN || process.env.DSPR_API_TOKEN;

/** Heavy-page timeout — large ranges × many stores (default 60 s). */
const UPSTREAM_TIMEOUT_MS =
  Number(process.env.BUSINESS_REPORTS_TIMEOUT_MS) || 60_000;

/**
 * POST /api/reports/multi-dashboard
 * Proxy → POST {MULTI_DASHBOARD_URL}
 *
 * Body: { start_date, end_date, stores }  (stores = string[] | "all")
 * Upstream validation errors (422) are passed through verbatim.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = DASHBOARD_API_TOKEN
    ? `Bearer ${DASHBOARD_API_TOKEN}`
    : authorization ?? "";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be JSON", 400);
  }

  try {
    const upstream = await fetchWithTimeout(
      MULTI_DASHBOARD_URL,
      {
        method: "POST",
        headers: {
          Authorization: upstreamAuth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
      UPSTREAM_TIMEOUT_MS,
      request.signal,
    );

    const responseBody = await upstream.text();

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse(
        "TIMEOUT",
        `The dashboard server did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try a smaller range or fewer stores.`,
        504,
      );
    }
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach the multi-dashboard service",
      502,
    );
  }
}
