import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
} from "@/app/api/_lib/auth";

const SCREEN_PROJECT_BASE_URL =
  process.env.SCREEN_PROJECT_BASE_URL ||
  process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL ||
  "https://control.screens.lcportal.cloud/api";

const UPSTREAM_TIMEOUT_MS = 60_000;

/** Which upstream reads exist, and the query keys each may forward. */
const SECTIONS: Record<string, string[]> = {
  report: ["stores[]", "from", "to", "tz", "users[]"],
  timeline: ["stores[]", "user_id", "from", "to"],
};

/**
 * GET /api/screen-project/usage/{report|timeline}?stores[]=…
 * Proxy → GET {SCREEN_PROJECT_BASE_URL}/usage/{report|timeline}
 * Screen Project monitoring across stores (store NUMBERS in stores[]).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { section } = await params;
  const allowed = SECTIONS[section];
  if (!allowed) return errorResponse("NOT_FOUND", "Unknown monitoring section", 404);

  const upstreamUrl = new URL(`${SCREEN_PROJECT_BASE_URL}/usage/${section}`);
  for (const key of allowed) {
    for (const value of request.nextUrl.searchParams.getAll(key)) upstreamUrl.searchParams.append(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      headers: { Authorization: getAuthorizationHeader(request)!, Accept: "application/json" },
      signal: controller.signal,
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach screen project service", 502);
  } finally {
    clearTimeout(timer);
  }
}
