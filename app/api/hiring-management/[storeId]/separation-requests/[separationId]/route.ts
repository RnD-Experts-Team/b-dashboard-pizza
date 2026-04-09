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

function upstreamUrl(storeId: string, separationId: string) {
  return `${HIRING_BASE_URL}/stores/${storeId}/separation-requests/${separationId}`;
}

async function proxyFetch(
  url: string,
  init: RequestInit,
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      ...init,
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
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach hiring service",
      502,
    );
  }
}

/**
 * GET /api/hiring-management/[storeId]/separation-requests/[separationId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; separationId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, separationId } = await params;

  return proxyFetch(upstreamUrl(storeId, separationId), {
    method: "GET",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}

/**
 * DELETE /api/hiring-management/[storeId]/separation-requests/[separationId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; separationId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, separationId } = await params;

  return proxyFetch(upstreamUrl(storeId, separationId), {
    method: "DELETE",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}
