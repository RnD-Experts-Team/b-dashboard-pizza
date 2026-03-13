import { NextRequest, NextResponse } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

const DATA_API_TOKEN = process.env.DATA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.DATA_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error helpers                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

type ErrorCode =
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }
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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  retries: number
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastError = new Error(`Upstream ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError")
        lastError = new Error("Upstream request timed out");
    }
    if (attempt < retries) {
      await new Promise((r) =>
        setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt))
      );
    }
  }
  throw lastError ?? new Error("All retries exhausted");
}

function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

async function handleUpstreamError(response: Response): Promise<NextResponse> {
  if (response.status === 401)
    return errorResponse("UNAUTHORIZED", "Authentication failed for the Data API.", 401);
  if (response.status === 403)
    return errorResponse("FORBIDDEN", "You do not have permission to access this resource.", 403);
  if (response.status === 404)
    return errorResponse("NOT_FOUND", "The requested tag was not found.", 404);
  if (response.status === 422) {
    let body: Record<string, unknown> = {};
    try { body = await response.json(); } catch { /* ignore */ }
    return errorResponse(
      "VALIDATION_ERROR",
      (body?.message as string) || "Validation error.",
      422,
      { errors: body?.errors }
    );
  }
  if (response.status === 429)
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
  return errorResponse(
    "UPSTREAM_ERROR",
    `Data API returned an error (${response.status}).`,
    502
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DELETE /api/data/tags/[id] — delete a single tag                        */
/* ────────────────────────────────────────────────────────────────────────── */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return errorResponse("INVALID_PARAM", "Tag ID must be a positive integer.", 400, { param: "id" });
  }

  const targetUrl = `${DATA_BASE_URL}/tags/${id}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      let responseBody = "";
      try { responseBody = await response.text(); } catch { /* ignore */ }
      if (!responseBody) {
        return new NextResponse(null, {
          status: 204,
          headers: { "Cache-Control": "no-store", "X-Response-Time": `${elapsed}ms` },
        });
      }
      return new NextResponse(responseBody, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    return await handleUpstreamError(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort"))
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}
