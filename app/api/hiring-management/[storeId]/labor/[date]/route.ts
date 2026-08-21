import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
} from "@/app/api/_lib/auth";

const HIRING_BASE_URL =
  process.env.HIRING_API_URL ||
  process.env.NEXT_PUBLIC_HIRING_API_URL ||
  "https://hiring.lcportal.cloud/api";

// Heavier than the other hiring reports: up to 12 weeks of aggregates plus the
// full employee roster in one response, so it gets a longer leash.
const UPSTREAM_TIMEOUT_MS = Number(process.env.HIRING_TIMEOUT_MS) || 30_000;

const TREND_WEEKS_DEFAULT = 6;
const TREND_WEEKS_MIN = 4;
const TREND_WEEKS_MAX = 12;

/**
 * GET /api/hiring-management/[storeId]/labor/[date]?trend_weeks=6
 * Proxy → GET {HIRING_BASE_URL}/v1/stores/{storeId}/labor/{date}?trend_weeks=N
 *
 * Whole-page labor report for the business week (Tuesday → Monday) containing
 * `date`: headcount, tenure, turnover, pay/performance metrics, overtime,
 * trailing-week trend, and the full employee roster.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; date: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, date } = await params;

  // Clamp rather than forward whatever arrived — the upstream caps at 12 and
  // an unparseable value should fall back to the default, not 400 upstream.
  const rawTrendWeeks = request.nextUrl.searchParams.get("trend_weeks");
  const parsed = rawTrendWeeks === null ? NaN : Number.parseInt(rawTrendWeeks, 10);
  const trendWeeks = Number.isFinite(parsed)
    ? Math.min(TREND_WEEKS_MAX, Math.max(TREND_WEEKS_MIN, parsed))
    : TREND_WEEKS_DEFAULT;

  const upstreamUrl =
    `${HIRING_BASE_URL}/v1/stores/${encodeURIComponent(storeId)}/labor/${encodeURIComponent(date)}` +
    `?trend_weeks=${trendWeeks}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

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
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}
