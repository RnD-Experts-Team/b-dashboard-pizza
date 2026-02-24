import { NextRequest, NextResponse } from "next/server";
import {
  getAuthorizationHeader,
  requireAuthorization,
} from "@/app/api/_lib/auth";

export const DATA_BASE_URL =
  process.env.DATA_API_URL ||
  process.env.NEXT_PUBLIC_DATA_API_URL ||
  "https://data.lcportal.cloud/api";

export const DATA_API_TOKEN = process.env.DATA_API_TOKEN;
export const UPSTREAM_TIMEOUT_MS = Number(process.env.DATA_TIMEOUT_MS) || 20_000;
export const MAX_RETRIES = 2;
export const RETRY_BASE_MS = 500;

export type ErrorCode =
  | "INVALID_PARAM"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR";

export function errorResponse(
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

export function validateAuth(request: NextRequest) {
  return requireAuthorization(request);
}

export function getUpstreamAuth(request: NextRequest): string {
  if (DATA_API_TOKEN) return `Bearer ${DATA_API_TOKEN}`;
  return getAuthorizationHeader(request) ?? "";
}

export async function fetchWithTimeout(
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

export async function fetchWithRetry(
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

export async function handleUpstreamError(response: Response) {
  let upstreamBody: Record<string, unknown> = {};
  try {
    upstreamBody = await response.json();
  } catch {
    upstreamBody = {};
  }

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
    return errorResponse("NOT_FOUND", "The requested resource was not found.", 404);
  }
  if (response.status === 422) {
    return errorResponse(
      "VALIDATION_ERROR",
      (upstreamBody?.message as string) || "Validation failed.",
      422,
      { errors: upstreamBody?.errors, upstream: upstreamBody }
    );
  }
  if (response.status === 429) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", 429);
  }

  return errorResponse(
    "UPSTREAM_ERROR",
    `Data API returned an error (${response.status}).`,
    502,
    process.env.NODE_ENV === "development"
      ? { upstreamStatus: response.status, upstream: upstreamBody }
      : undefined
  );
}

export function proxyJsonResponse(responseText: string, status: number = 200) {
  return new NextResponse(responseText, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function handleFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.includes("timed out") || message.includes("abort")) {
    return errorResponse("TIMEOUT", "The Data API did not respond in time.", 504);
  }
  return errorResponse("NETWORK_ERROR", "Unable to reach the Data API.", 503);
}
