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

async function proxyRequest(
  method: string,
  authorization: string,
  url: string,
  body?: ArrayBuffer,
  contentType?: string,
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  const upstream = await fetch(url, {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    ...(body !== undefined ? { body } : {}),
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
}

/**
 * GET /api/hiring-management/[storeId]/employees/[employeeId]
 * Proxy -> GET {HIRING_BASE_URL}/stores/{storeId}/employees/{employeeId}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, employeeId } = await params;

  try {
    return await proxyRequest(
      "GET",
      authorization,
      `${HIRING_BASE_URL}/stores/${storeId}/employees/${employeeId}`,
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}

/**
 * POST /api/hiring-management/[storeId]/employees/[employeeId]
 * Proxy -> POST {HIRING_BASE_URL}/stores/{storeId}/employees/{employeeId}
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, employeeId } = await params;

  try {
    const contentType = request.headers.get("Content-Type") || "application/json";
    const body = await request.arrayBuffer();
    return await proxyRequest(
      "POST",
      authorization,
      `${HIRING_BASE_URL}/stores/${storeId}/employees/${employeeId}`,
      body,
      contentType,
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}

/**
 * DELETE /api/hiring-management/[storeId]/employees/[employeeId]
 * Proxy -> DELETE {HIRING_BASE_URL}/stores/{storeId}/employees/{employeeId}
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, employeeId } = await params;

  try {
    return await proxyRequest(
      "DELETE",
      authorization,
      `${HIRING_BASE_URL}/stores/${storeId}/employees/${employeeId}`,
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}