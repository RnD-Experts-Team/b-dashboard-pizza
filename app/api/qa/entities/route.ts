import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  isRetryableStatus,
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
      if (!isRetryableStatus(res.status)) return res;
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
/*  GET /api/qa/entities                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  // Auth check
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // Build upstream request
  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";
  const targetUrl = `${QA_BASE_URL}/entities`;

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

    if (response.ok) {
      const responseBody = await response.text();
      try {
        JSON.parse(responseBody);
      } catch {
        return errorResponse(
          "UPSTREAM_ERROR",
          "Upstream returned invalid JSON",
          502,
          { upstreamStatus: response.status }
        );
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
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication failed for the QA API.",
        401,
        { upstream: true, tokenConfigured: !!QA_API_TOKEN }
      );
    }
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to view QA entities.",
        403
      );
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502,
      process.env.NODE_ENV === "development"
        ? { upstreamStatus: response.status }
        : undefined
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

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
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/qa/entities                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  // Auth check
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // Parse request body
  let body: {
    entity_label?: string;
    category_id?: number;
    date_range_type?: string;
    report_type?: string;
    sort_order?: number;
    active?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "INVALID_PARAM",
      "Invalid JSON in request body.",
      400
    );
  }

  // Validate entity_label (required, string, max 255)
  if (
    !body.entity_label ||
    typeof body.entity_label !== "string" ||
    !body.entity_label.trim()
  ) {
    return errorResponse("VALIDATION_ERROR", "Entity label is required.", 422, {
      field: "entity_label",
    });
  }

  if (body.entity_label.length > 255) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Entity label must be 255 characters or less.",
      422,
      { field: "entity_label", maxLength: 255 }
    );
  }

  // Validate date_range_type (required, must be "daily" or "weekly")
  if (!body.date_range_type || typeof body.date_range_type !== "string") {
    return errorResponse(
      "VALIDATION_ERROR",
      "Date range type is required.",
      422,
      { field: "date_range_type" }
    );
  }

  if (!["daily", "weekly"].includes(body.date_range_type)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Date range type must be either 'daily' or 'weekly'.",
      422,
      { field: "date_range_type", allowed: ["daily", "weekly"] }
    );
  }

  // Validate active (required, boolean)
  if (typeof body.active !== "boolean") {
    return errorResponse(
      "VALIDATION_ERROR",
      "Active status is required and must be a boolean.",
      422,
      { field: "active" }
    );
  }

  // Validate category_id (optional but must be a number if provided)
  if (body.category_id !== undefined && typeof body.category_id !== "number") {
    return errorResponse(
      "VALIDATION_ERROR",
      "Category ID must be a number.",
      422,
      { field: "category_id" }
    );
  }

  // Validate sort_order (optional but must be a number if provided)
  if (body.sort_order !== undefined && typeof body.sort_order !== "number") {
    return errorResponse(
      "VALIDATION_ERROR",
      "Sort order must be a number.",
      422,
      { field: "sort_order" }
    );
  }

  // Build upstream request
  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";
  const targetUrl = `${QA_BASE_URL}/entities`;

  const upstreamBody = JSON.stringify({
    entity_label: body.entity_label.trim(),
    date_range_type: body.date_range_type,
    active: body.active,
    ...(body.category_id !== undefined && { category_id: body.category_id }),
    ...(body.report_type !== undefined && { report_type: body.report_type }),
    ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
  });

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "POST",
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

    if (response.ok) {
      const responseBody = await response.text();
      try {
        JSON.parse(responseBody);
      } catch {
        return errorResponse(
          "UPSTREAM_ERROR",
          "Upstream returned invalid JSON",
          502,
          { upstreamStatus: response.status }
        );
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
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication failed for the QA API.",
        401,
        { upstream: true, tokenConfigured: !!QA_API_TOKEN }
      );
    }
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to create QA entities.",
        403
      );
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
        "Validation failed on the QA API. The data may already exist or is invalid.",
        422,
        { upstream: upstreamErrors }
      );
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please wait before trying again.",
        429,
        retryAfter
          ? { retryAfter: Number(retryAfter) || retryAfter }
          : undefined
      );
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502,
      process.env.NODE_ENV === "development"
        ? { upstreamStatus: response.status }
        : undefined
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

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
}
