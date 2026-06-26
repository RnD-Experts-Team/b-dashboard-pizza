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
 * GET /api/v1/stores/[storeId]/milestone-gift-questions
 * Proxy → GET {HIRING_BASE_URL}/v1/stores/{storeId}/milestone-gift-questions
 * Returns the active questions (global + store-specific) for the rating form.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId } = await params;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${HIRING_BASE_URL}/v1/stores/${encodeURIComponent(storeId)}/milestone-gift-questions`,
      {
        method: "GET",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

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
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach hiring service",
      502,
    );
  }
}
