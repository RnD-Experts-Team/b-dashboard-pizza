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

const EXPORT_TIMEOUT_MS =
  Number(process.env.HIRING_EXPORT_TIMEOUT_MS) ||
  Number(process.env.HIRING_TIMEOUT_MS) ||
  5 * 60_000;

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
    const timer = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);

    const upstream = await fetch(
      `${HIRING_BASE_URL}/stores/${encodeURIComponent(storeId)}/exports/hiring-requests`,
      {
        method: "GET",
        headers: {
          Authorization: authorization,
          Accept: "*/*",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timer);

    if (!upstream.ok) {
      const responseBody = await upstream.text();
      return new NextResponse(responseBody, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    if (!upstream.body) {
      return errorResponse("UPSTREAM_ERROR", "Empty export response body.", 502);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ||
          'attachment; filename="hiring-requests-export.xlsx"',
        "Cache-Control": "no-store",
        ...(upstream.headers.get("Content-Length")
          ? { "Content-Length": upstream.headers.get("Content-Length") as string }
          : {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}
