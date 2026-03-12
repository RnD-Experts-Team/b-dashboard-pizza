import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

const QA_BASE_URL =
  process.env.QA_API_URL ||
  process.env.NEXT_PUBLIC_QA_API_URL ||
  "https://qa.lcportal.cloud/api";

const QA_API_TOKEN = process.env.QA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details && { details }) },
    },
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET /api/qa/camera-forms/[id]                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";

  const targetUrl = `${QA_BASE_URL}/camera-forms/${id}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    if (response.status === 401) {
      return errorResponse("UNAUTHORIZED", "Authentication failed.", 401);
    }
    if (response.status === 403) {
      return errorResponse("FORBIDDEN", "Permission denied.", 403);
    }
    if (response.status === 404) {
      return errorResponse("NOT_FOUND", "Camera form not found.", 404);
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "Request timed out.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the QA API.", 503);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/qa/camera-forms/[id]                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(
      "INVALID_PARAM",
      "Invalid form data in request body.",
      400
    );
  }

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";

  const upstreamFormData = new FormData();
  for (const [key, value] of formData.entries()) {
    upstreamFormData.append(key, value);
  }

  const targetUrl = `${QA_BASE_URL}/camera-forms/${id}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
        body: upstreamFormData,
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    if (response.status === 401) {
      return errorResponse("UNAUTHORIZED", "Authentication failed.", 401);
    }
    if (response.status === 403) {
      return errorResponse("FORBIDDEN", "Permission denied.", 403);
    }
    if (response.status === 404) {
      return errorResponse("NOT_FOUND", "Camera form not found.", 404);
    }
    if (response.status === 422) {
      let upstreamBody: Record<string, unknown> = {};
      try {
        upstreamBody = await response.json();
      } catch { /* ignore */ }
      return errorResponse(
        "VALIDATION_ERROR",
        (upstreamBody as { message?: string })?.message || "Validation failed.",
        422,
        { upstream: upstreamBody }
      );
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "Request timed out.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the QA API.", 503);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DELETE /api/qa/camera-forms/[id]                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const startTime = Date.now();

  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";

  const xStoreId = request.headers.get("X-Store-Id");
  const targetUrl = `${QA_BASE_URL}/camera-forms/${id}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
          ...(xStoreId && { "X-Store-Id": xStoreId }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body || JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    if (response.status === 401) {
      return errorResponse("UNAUTHORIZED", "Authentication failed.", 401);
    }
    if (response.status === 403) {
      return errorResponse("FORBIDDEN", "Permission denied.", 403);
    }
    if (response.status === 404) {
      return errorResponse("NOT_FOUND", "Camera form not found.", 404);
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "Request timed out.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the QA API.", 503);
  }
}
