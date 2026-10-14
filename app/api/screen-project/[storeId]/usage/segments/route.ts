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

async function forward(request: NextRequest, storeId: string, init: RequestInit & { search?: string }) {
  const authorization = getAuthorizationHeader(request)!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(
      `${SCREEN_PROJECT_BASE_URL}/${encodeURIComponent(storeId)}/usage/segments${init.search ?? ""}`,
      {
        method: init.method,
        body: init.body,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    const body = upstream.status === 204 ? null : await upstream.text();

    return new NextResponse(body, {
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

/**
 * GET /api/screen-project/[storeId]/usage/segments?from&to
 * Proxy → GET {SCREEN_PROJECT_BASE_URL}/{storeId}/usage/segments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;
  return forward(request, storeId, { method: "GET", search: request.nextUrl.search });
}

/**
 * POST /api/screen-project/[storeId]/usage/segments
 * Proxy → POST {SCREEN_PROJECT_BASE_URL}/{storeId}/usage/segments
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;
  return forward(request, storeId, { method: "POST", body: await request.text() });
}
