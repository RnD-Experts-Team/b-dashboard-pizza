import { NextRequest, NextResponse } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  fetchWithRetry,
  getHeaders,
  requireAuthorization,
} from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cleaning/reports/csv?period_type=&period_key=
 * Streams the upstream CSV through verbatim (no JSON parsing).
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  const targetUrl = `${CLEANING_BASE_URL}/reports/csv${search}`;

  try {
    const response = await fetchWithRetry(targetUrl, {
      method: "GET",
      headers: getHeaders(request),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return errorResponse(
        response.status === 401
          ? "UNAUTHORIZED"
          : response.status === 403
            ? "FORBIDDEN"
            : "UPSTREAM_ERROR",
        text || `The cleaning API returned an error (${response.status}).`,
        response.status >= 400 && response.status < 500 ? response.status : 502
      );
    }

    const body = await response.arrayBuffer();
    const contentType =
      response.headers.get("Content-Type") || "text/csv; charset=utf-8";
    const disposition =
      response.headers.get("Content-Disposition") ||
      'attachment; filename="cleaning-report.csv"';

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The cleaning API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the cleaning API.", 503);
  }
}
