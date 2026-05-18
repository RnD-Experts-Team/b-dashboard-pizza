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

const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * POST /api/screen-project/[storeId]/stations/[stationId]/media/[mediaId]/primary
 * Proxy → POST {SCREEN_PROJECT_BASE_URL}/{storeId}/stations/{stationId}/media/{mediaId}/primary
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ storeId: string; stationId: string; mediaId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, stationId, mediaId } = await params;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${SCREEN_PROJECT_BASE_URL}/${storeId}/stations/${stationId}/media/${mediaId}/primary`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

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
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach screen project service",
      502,
    );
  }
}
