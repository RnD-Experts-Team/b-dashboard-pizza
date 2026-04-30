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
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

type ErrorCode =
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR";

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
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`Upstream ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (lastError.name === "AbortError") {
        lastError = new Error("Upstream request timed out");
      }
    }

    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_MS * Math.pow(2, attempt))
      );
    }
  }

  throw lastError ?? new Error("All retries exhausted");
}

function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

async function handleUpstreamError(response: Response) {
  if (response.status === 401) {
    return errorResponse("UNAUTHORIZED", "Authentication failed for Data API.", 401);
  }
  if (response.status === 403) {
    return errorResponse(
      "FORBIDDEN",
      "You do not have permission to access this resource.",
      403
    );
  }
  if (response.status === 404) {
    return errorResponse(
      "NOT_FOUND",
      "Employee debriefs were not found for this store.",
      404
    );
  }
  if (response.status === 422) {
    let body: Record<string, unknown> = {};
    try {
      body = await response.json();
    } catch {
      /* ignore */
    }
    return errorResponse(
      "VALIDATION_ERROR",
      (body?.message as string) || "Validation failed.",
      422,
      { errors: body?.errors }
    );
  }
  if (response.status === 429) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
  }
  return errorResponse(
    "UPSTREAM_ERROR",
    `Data API returned an error (${response.status}).`,
    502
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;

  if (!storeId?.trim()) {
    return errorResponse("INVALID_PARAM", "storeId is required.", 400, {
      param: "storeId",
    });
  }

  const { searchParams } = request.nextUrl;
  const queryString = searchParams.toString();
  const targetUrl = `${DATA_BASE_URL}/stores/${encodeURIComponent(storeId)}/employee-debriefs${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetchWithRetry(
      targetUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getUpstreamAuth(request),
        },
      },
      UPSTREAM_TIMEOUT_MS,
      MAX_RETRIES
    );

    if (response.ok) {
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    return await handleUpstreamError(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;

  if (!storeId?.trim()) {
    return errorResponse("INVALID_PARAM", "storeId is required.", 400, {
      param: "storeId",
    });
  }

  // Support both multipart/form-data (with attachments) and application/json
  const contentType = request.headers.get("content-type") ?? "";
  let date: string | undefined;
  let employee_id: number | undefined;
  let note: string | undefined;
  let upstreamBody: BodyInit;
  let upstreamContentType: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("INVALID_PARAM", "Invalid multipart/form-data body.", 400);
    }
    date = formData.get("date")?.toString();
    employee_id = Number(formData.get("employee_id"));
    note = formData.get("note")?.toString();

    if (!date?.trim()) {
      return errorResponse("INVALID_PARAM", "date is required.", 400, { param: "date" });
    }
    if (!Number.isInteger(employee_id) || employee_id <= 0) {
      return errorResponse("INVALID_PARAM", "employee_id is required and must be a positive integer.", 400, { param: "employee_id" });
    }
    if (!note?.trim()) {
      return errorResponse("INVALID_PARAM", "note is required.", 400, { param: "note" });
    }
    if (note.length > 5000) {
      return errorResponse("VALIDATION_ERROR", "note must be at most 5000 characters.", 422);
    }
    // Forward the FormData as-is (browser will set the correct boundary)
    upstreamBody = formData;
    upstreamContentType = undefined; // let fetch set Content-Type with boundary
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("INVALID_PARAM", "Request body must be valid JSON.", 400);
    }
    date = body.date as string | undefined;
    employee_id = body.employee_id as number | undefined;
    note = body.note as string | undefined;
    const employee_name = body.employee_name;

    if (!date || typeof date !== "string" || !date.trim()) {
      return errorResponse("INVALID_PARAM", "date is required.", 400, { param: "date" });
    }
    if (employee_id === undefined || employee_id === null || typeof employee_id !== "number" || !Number.isInteger(employee_id) || employee_id <= 0) {
      return errorResponse("INVALID_PARAM", "employee_id is required and must be a positive integer.", 400, { param: "employee_id" });
    }
    if (!note || typeof note !== "string" || !note.trim()) {
      return errorResponse("INVALID_PARAM", "note is required.", 400, { param: "note" });
    }
    if (note.length > 5000) {
      return errorResponse("VALIDATION_ERROR", "note must be at most 5000 characters.", 422);
    }
    upstreamBody = JSON.stringify({
      date: date.trim(),
      employee_id,
      employee_name: typeof employee_name === "string" ? employee_name.trim() : undefined,
      note: note.trim(),
    });
    upstreamContentType = "application/json";
  }

  const targetUrl = `${DATA_BASE_URL}/stores/${encodeURIComponent(storeId)}/employee-debriefs`;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: getUpstreamAuth(request),
    };
    if (upstreamContentType) headers["Content-Type"] = upstreamContentType;

    const response = await fetchWithTimeout(
      targetUrl,
      {
        method: "POST",
        headers,
        body: upstreamBody,
      },
      UPSTREAM_TIMEOUT_MS
    );

    if (response.ok) {
      const responseText = await response.text();
      return new NextResponse(responseText || null, {
        status: response.status === 204 ? 204 : 201,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    return await handleUpstreamError(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("timed out") || message.includes("abort")) {
      return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
    }
    return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
  }
}
