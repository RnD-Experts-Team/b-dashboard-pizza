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
const UPSTREAM_TIMEOUT_MS =
  Number(process.env.QA_EXPORT_TIMEOUT_MS) ||
  Number(process.env.QA_TIMEOUT_MS) ||
  5 * 60_000;
const MAX_RETRIES = 1;
const RETRY_BASE_MS = 500;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Error helpers                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

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
/*  Allowed query parameters                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const ALLOWED_PARAMS = [
  "store_id",
  "group",
  "report_type",
  "date_from",
  "date_to",
  "rating_id",
  "date_range_type",
] as const;

const VALID_REPORT_TYPES = ["main", "secondary"];
const VALID_DATE_RANGE_TYPES = ["daily", "weekly"];

/* ────────────────────────────────────────────────────────────────────────── */
/*  GET /api/qa/camera-reports/exportImages                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Auth check
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // Parse and validate query params
  const { searchParams } = new URL(request.url);
  const upstreamParams = new URLSearchParams();

  for (const param of ALLOWED_PARAMS) {
    const value = searchParams.get(param);
    if (value !== null && value !== "") {
      if (["store_id", "group", "rating_id"].includes(param)) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < 1 || !Number.isInteger(num)) {
          return errorResponse(
            "INVALID_PARAM",
            `${param} must be a positive integer`,
            400,
            { param }
          );
        }
      }

      if (param === "report_type" && !VALID_REPORT_TYPES.includes(value)) {
        return errorResponse(
          "INVALID_PARAM",
          `report_type must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
          400,
          { param: "report_type" }
        );
      }

      if (
        param === "date_range_type" &&
        !VALID_DATE_RANGE_TYPES.includes(value)
      ) {
        return errorResponse(
          "INVALID_PARAM",
          `date_range_type must be one of: ${VALID_DATE_RANGE_TYPES.join(", ")}`,
          400,
          { param: "date_range_type" }
        );
      }

      if (["date_from", "date_to"].includes(param)) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(value) || isNaN(Date.parse(value))) {
          return errorResponse(
            "INVALID_PARAM",
            `${param} must be a valid date in YYYY-MM-DD format`,
            400,
            { param }
          );
        }
      }

      upstreamParams.set(param, value);
    }
  }

  const rawCategoryIds = [
    ...searchParams.getAll("category_ids[]"),
    ...searchParams.getAll("category_ids"),
  ];

  if (rawCategoryIds.length > 0) {
    const uniqueCategoryIds = Array.from(
      new Set(rawCategoryIds.filter((id) => id !== ""))
    );

    for (const categoryId of uniqueCategoryIds) {
      const num = Number(categoryId);
      if (!Number.isFinite(num) || num < 1 || !Number.isInteger(num)) {
        return errorResponse(
          "INVALID_PARAM",
          "category_ids[] must contain only positive integers",
          400,
          { param: "category_ids[]", value: categoryId }
        );
      }

      upstreamParams.append("category_ids[]", categoryId);
    }
  }

  // Build upstream URL
  const authorization = getAuthorizationHeader(request);
  const upstreamAuth = QA_API_TOKEN
    ? `Bearer ${QA_API_TOKEN}`
    : authorization ?? "";

  const queryString = upstreamParams.toString();
  const targetUrl = `${QA_BASE_URL}/camera-reports/exportImages${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "*/*",
          ...(upstreamAuth && { Authorization: upstreamAuth }),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const contentType =
        response.headers.get("Content-Type") || "application/octet-stream";
      const contentDisposition =
        response.headers.get("Content-Disposition") ||
        'attachment; filename="camera-report-images.zip"';
      const contentLength = response.headers.get("Content-Length");

      if (!response.body) {
        return errorResponse(
          "UPSTREAM_ERROR",
          "QA API returned an empty export response body.",
          502
        );
      }

      return new NextResponse(response.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": contentDisposition,
          "Cache-Control": "no-store",
          ...(contentLength ? { "Content-Length": contentLength } : {}),
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    if (response.status === 401) {
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication failed for the QA API.",
        401
      );
    }
    if (response.status === 403) {
      return errorResponse(
        "FORBIDDEN",
        "You do not have permission to export camera reports.",
        403
      );
    }
    if (response.status === 404) {
      return errorResponse(
        "NOT_FOUND",
        "Camera reports export endpoint not found.",
        404
      );
    }
    if (response.status === 429) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please wait before trying again.",
        429
      );
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      `QA API returned an error (${response.status}).`,
      502
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
