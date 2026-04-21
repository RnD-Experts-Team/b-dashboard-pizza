import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
} from "@/app/api/_lib/auth";

const NOTIFICATIONS_BASE_URL =
  process.env.NOTIFICATIONS_API_URL ||
  process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL ||
  "https://notifications.lcportal.cloud/api";

const UPSTREAM_TIMEOUT_MS =
  Number(process.env.NOTIFICATIONS_TIMEOUT_MS) || 15_000;

/**
 * POST /api/notifications/:id/read
 * Proxy → POST {NOTIFICATIONS_BASE_URL}/notifications/:id/read
 * Marks a single notification as read.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { id } = await params;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${NOTIFICATIONS_BASE_URL}/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    const body = await upstream.text();

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
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach notifications service",
      502,
    );
  }
}
