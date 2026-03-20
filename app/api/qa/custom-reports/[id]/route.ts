import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

const QA_BASE_URL =
  process.env.QA_API_URL ||
  process.env.NEXT_PUBLIC_QA_API_URL ||
  "https://qa.lcportal.cloud/api";

const QA_API_TOKEN = process.env.QA_API_TOKEN;
const UPSTREAM_TIMEOUT_MS = Number(process.env.QA_TIMEOUT_MS) || 15_000;
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fetch utilities                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

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
/*  Shared upstream helpers                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function handleUpstreamError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.includes("timed out") || message.includes("abort")) {
    return errorResponse(
      "TIMEOUT",
      `The QA API did not respond within ${UPSTREAM_TIMEOUT_MS / 1_000}s. Please try again.`,
      504
    );
  }

  return errorResponse(
    "NETWORK_ERROR",
    "Unable to reach the QA API. Please check your connection and try again.",
    503
  );
}

async function handleUpstreamResponse(response: Response, action: string) {
  if (response.ok) {
    const responseBody = await response.text();
    if (!responseBody) {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    try {
      JSON.parse(responseBody);
    } catch {
      return errorResponse("UPSTREAM_ERROR", "Upstream returned invalid JSON", 502, {
        upstreamStatus: response.status,
      });
    }
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  if (response.status === 401) {
    return errorResponse("UNAUTHORIZED", "Authentication failed for the QA API.", 401, {
      upstream: true,
      tokenConfigured: !!QA_API_TOKEN,
    });
  }
  if (response.status === 403) {
    return errorResponse(
      "FORBIDDEN",
      `You do not have permission to ${action} this custom report.`,
      403
    );
  }
  if (response.status === 404) {
    return errorResponse("NOT_FOUND", "The requested custom report was not found.", 404);
  }
  if (response.status === 422) {
    let upstreamErrors: Record<string, unknown> = {};
    try {
      upstreamErrors = await response.json();
    } catch {
      // ignore parse errors
    }
    return errorResponse(
      "VALIDATION_ERROR",
      "Validation failed on the QA API. Please check your input.",
      422,
      { upstream: upstreamErrors }
    );
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait before trying again.", 429, retryAfter ? { retryAfter: Number(retryAfter) || retryAfter } : undefined);
  }

  return errorResponse(
    "UPSTREAM_ERROR",
    `QA API returned an error (${response.status}).`,
    502,
    process.env.NODE_ENV === "development" ? { upstreamStatus: response.status } : undefined
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET /api/qa/custom-reports/[id]                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { id } = await params;
  const reportId = Number(id);
  if (!id || isNaN(reportId) || reportId < 1) {
    return errorResponse("INVALID_PARAM", "Invalid custom report ID.", 400);
  }

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";
  const targetUrl = `${QA_BASE_URL}/custom-reports/${reportId}`;

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

    return handleUpstreamResponse(response, "view");
  } catch (error) {
    return handleUpstreamError(error);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  PUT /api/qa/custom-reports/[id]                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { id } = await params;
  const reportId = Number(id);
  if (!id || isNaN(reportId) || reportId < 1) {
    return errorResponse("INVALID_PARAM", "Invalid custom report ID.", 400);
  }

  let body: { name?: string; entity_ids?: number[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  // Validate name
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return errorResponse("VALIDATION_ERROR", "Name is required.", 422, { field: "name" });
  }
  if (body.name.length > 255) {
    return errorResponse("VALIDATION_ERROR", "Name must be 255 characters or less.", 422, {
      field: "name",
      maxLength: 255,
    });
  }

  // Validate entity_ids
  if (!body.entity_ids || !Array.isArray(body.entity_ids) || body.entity_ids.length === 0) {
    return errorResponse("VALIDATION_ERROR", "At least one entity ID is required.", 422, {
      field: "entity_ids",
    });
  }
  if (!body.entity_ids.every((id) => typeof id === "number" && Number.isInteger(id))) {
    return errorResponse("VALIDATION_ERROR", "All entity IDs must be integers.", 422, {
      field: "entity_ids",
    });
  }

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";
  const targetUrl = `${QA_BASE_URL}/custom-reports/${reportId}`;

  const upstreamBody = JSON.stringify({
    name: body.name.trim(),
    entity_ids: body.entity_ids,
  });

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
        body: upstreamBody,
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    return handleUpstreamResponse(response, "update");
  } catch (error) {
    return handleUpstreamError(error);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  DELETE /api/qa/custom-reports/[id]                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { id } = await params;
  const reportId = Number(id);
  if (!id || isNaN(reportId) || reportId < 1) {
    return errorResponse("INVALID_PARAM", "Invalid custom report ID.", 400);
  }

  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";
  const targetUrl = `${QA_BASE_URL}/custom-reports/${reportId}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    return handleUpstreamResponse(response, "delete");
  } catch (error) {
    return handleUpstreamError(error);
  }
}
