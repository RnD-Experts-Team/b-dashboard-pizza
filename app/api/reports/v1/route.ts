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

/** Hiring service base URL (the "hiring" base URL). */
const HIRING_BASE_URL =
  process.env.HIRING_API_URL ||
  process.env.NEXT_PUBLIC_HIRING_API_URL ||
  "https://hiring.lcportal.cloud/api";

/** Heavy-page timeout (default 60 s). */
const UPSTREAM_TIMEOUT_MS =
  Number(process.env.BUSINESS_REPORTS_TIMEOUT_MS) || 60_000;

/**
 * GET /api/reports/v1?stores[]=…&start_date=…&end_date=…
 * Proxy → GET {HIRING_BASE_URL}/v1/reports?<same query>
 *
 * The incoming query string (stores[]/start_date/end_date) is forwarded
 * verbatim, so the client controls the exact parameter shape.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const search = request.nextUrl.search; // includes leading "?"
  const upstreamUrl = `${HIRING_BASE_URL}/v1/reports${search}`;

  try {
    const upstream = await fetchWithTimeout(
      upstreamUrl,
      {
        method: "GET",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
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
        `The hiring server did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try a smaller range or fewer stores.`,
        504,
      );
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}
