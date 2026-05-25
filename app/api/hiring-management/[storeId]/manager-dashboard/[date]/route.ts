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

const UPSTREAM_TIMEOUT_MS =
  Number(process.env.HIRING_TIMEOUT_MS) || 15_000;

/**
 * GET /api/hiring-management/[storeId]/manager-dashboard/[date]
 * Proxy → GET {HIRING_BASE_URL}/v1/stores/{storeId}/manager-dashboard/{date}
 *
 * Returns all active employees for the store with upcoming birthday flags,
 * current position, pay info, and performance metric (column id 3) for the
 * week containing `date`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; date: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, date } = await params;

  const upstreamUrl = `${HIRING_BASE_URL}/v1/stores/${encodeURIComponent(storeId)}/manager-dashboard/${encodeURIComponent(date)}`;

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
