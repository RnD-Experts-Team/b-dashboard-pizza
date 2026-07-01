import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  errorResponse,
  fetchWithTimeout,
} from "@/app/api/_lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Hook service base URL (the "hook" base URL). */
const HOOKS_BASE_URL =
  process.env.HOOKS_API_URL || process.env.NEXT_PUBLIC_HOOKS_API_URL || "";

/** Server-only secret — never exposed to the browser. */
const HOOKS_SECRET_KEY =
  process.env.HOOKS_API_URL_HEADER_KEY ||
  process.env.NEXT_PUBLIC_HOOKS_API_URL_HEADER_KEY ||
  "";

/** Heavy-page timeout (default 60 s). */
const UPSTREAM_TIMEOUT_MS =
  Number(process.env.BUSINESS_REPORTS_TIMEOUT_MS) || 60_000;

/**
 * GET /api/reports/wbr-bulk?stores[]=…&start_date=…&end_date=…
 * Proxy → GET {HOOKS_BASE_URL}/reports/wbr/bulk?<same query>
 *
 * Adds the X-Secret-Key header server-side only. The incoming query string
 * (stores[]/stores/start_date/end_date) is forwarded verbatim.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search; // includes leading "?"
  const upstreamUrl = `${HOOKS_BASE_URL}/reports/wbr/bulk${search}`;

  try {
    const upstream = await fetchWithTimeout(
      upstreamUrl,
      {
        method: "GET",
        headers: {
          "X-Secret-Key": HOOKS_SECRET_KEY,
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
        `The hooks server did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s. Please try a smaller range or fewer stores.`,
        504,
      );
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hooks service", 502);
  }
}
