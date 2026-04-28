import { NextRequest, NextResponse } from "next/server";
import {
  getAuthorizationHeader,
  requireAuthorization,
} from "@/app/api/_lib/auth";

const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const DATA_API_TOKEN = process.env.DATA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.DATA_TIMEOUT_MS) || 15_000;

type ErrorCode =
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;

  if (!storeId?.trim()) {
    return errorResponse("INVALID_PARAM", "storeId is required.", 400, { param: "storeId" });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from?.trim()) {
    return errorResponse("INVALID_PARAM", "from date is required.", 400, { param: "from" });
  }
  if (!to?.trim()) {
    return errorResponse("INVALID_PARAM", "to date is required.", 400, { param: "to" });
  }

  const queryString = searchParams.toString();
  const targetUrl = `${DATA_BASE_URL}/stores/${encodeURIComponent(storeId)}/employee-debriefs/range?${queryString}`;

  try {
    const response = await fetchWithTimeout(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
      },
      UPSTREAM_TIMEOUT_MS
    );

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const status = response.status;
    if (status === 401) return errorResponse("UNAUTHORIZED", "Authentication failed.", 401);
    if (status === 403) return errorResponse("FORBIDDEN", "Access denied.", 403);
    if (status === 404) return errorResponse("NOT_FOUND", "Resource not found.", 404);
    if (status === 429) return errorResponse("RATE_LIMITED", "Too many requests.", 429);
    return errorResponse("UPSTREAM_ERROR", `Upstream error (${status}).`, 502);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}
