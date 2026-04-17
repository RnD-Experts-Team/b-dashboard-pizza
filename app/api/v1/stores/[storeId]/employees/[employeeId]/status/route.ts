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
 * PATCH /api/v1/stores/[storeId]/employees/[employeeId]/status
 * Proxy → PATCH {HIRING_BASE_URL}/v1/stores/{storeId}/employees/{employeeId}/status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, employeeId } = await params;

  let body: string;
  try {
    body = await request.text();
  } catch {
    return errorResponse("INVALID_REQUEST", "Failed to read request body", 400);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(
      `${HIRING_BASE_URL}/v1/stores/${encodeURIComponent(storeId)}/employees/${encodeURIComponent(employeeId)}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
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
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}
