import { NextRequest } from "next/server";
import {
  DATA_BASE_URL,
  MAX_RETRIES,
  UPSTREAM_TIMEOUT_MS,
  errorResponse,
  fetchWithRetry,
  getUpstreamAuth,
  handleFetchError,
  handleUpstreamError,
  proxyJsonResponse,
  validateAuth,
} from "../_lib/route-utils";

const ALLOWED_TYPES = new Set([
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "all",
]);

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON body.", 400);
  }

  const payload = body as {
    start_date?: string;
    end_date?: string;
    type?: string;
  };

  if (!payload.start_date || !isValidDate(payload.start_date)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "start_date is required and must be YYYY-MM-DD.",
      422,
      { field: "start_date" }
    );
  }

  if (!payload.end_date || !isValidDate(payload.end_date)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "end_date is required and must be YYYY-MM-DD.",
      422,
      { field: "end_date" }
    );
  }

  if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
    return errorResponse("VALIDATION_ERROR", "type is invalid.", 422, {
      field: "type",
      allowed: Array.from(ALLOWED_TYPES),
    });
  }

  const targetUrl = `${DATA_BASE_URL}/manual-import/reaggregate`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
        body: JSON.stringify(payload),
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    if (response.ok) {
      const responseText = await response.text();
      return proxyJsonResponse(responseText, response.status);
    }

    return await handleUpstreamError(response);
  } catch (error) {
    return handleFetchError(error);
  }
}
