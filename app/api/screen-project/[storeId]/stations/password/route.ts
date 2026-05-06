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
 * POST /api/screen-project/[storeId]/stations/password
 * Proxy → POST {SCREEN_PROJECT_BASE_URL}/{storeId}/stations/password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId } = await params;

  if (!storeId) {
    return errorResponse("VALIDATION_ERROR", "storeId is required", 400);
  }

  // Read raw body text; validate it is JSON that contains a password field.
  let rawBody: string;
  try {
    rawBody = await request.text();
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    if (!parsed.password || typeof parsed.password !== "string") {
      return errorResponse("VALIDATION_ERROR", "password is required", 400);
    }
    // Only forward the expected fields.
    rawBody = JSON.stringify({ password: parsed.password });
  } catch {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${SCREEN_PROJECT_BASE_URL}/${storeId}/stations/password`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: rawBody,
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    const responseBody = await upstream.text();

    if (!upstream.ok) {
      console.error(
        `[screen-project] password upstream error ${upstream.status}:`,
        responseBody,
      );
    }

    // 204 No Content — body must be empty
    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(responseBody, {
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[screen-project] password fetch failed:", message);
    return errorResponse(
      "UPSTREAM_ERROR",
      `Failed to reach screen project service: ${message}`,
      502,
    );
  }
}
