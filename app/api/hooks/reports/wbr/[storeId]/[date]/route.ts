import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  errorResponse,
} from "@/app/api/_lib/auth";

const HOOKS_BASE_URL =
  process.env.HOOKS_API_URL ||
  process.env.NEXT_PUBLIC_HOOKS_API_URL ||
  "";

const HOOKS_SECRET_KEY =
  process.env.HOOKS_API_URL_HEADER_KEY ||
  process.env.NEXT_PUBLIC_HOOKS_API_URL_HEADER_KEY ||
  "";

const UPSTREAM_TIMEOUT_MS =
  Number(process.env.HOOKS_TIMEOUT_MS) || 15_000;

/**
 * GET /api/hooks/reports/wbr/[storeId]/[date]
 * Proxy → GET {HOOKS_BASE_URL}/reports/wbr/{storeId}/{date}
 *
 * Uses X-Secret-Key for upstream auth (added server-side only —
 * never visible in the browser network tab).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; date: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId, date } = await params;

  const upstreamUrl = `${HOOKS_BASE_URL}/reports/wbr/${encodeURIComponent(storeId)}/${encodeURIComponent(date)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "X-Secret-Key": HOOKS_SECRET_KEY,
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
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hooks service", 502);
  }
}
