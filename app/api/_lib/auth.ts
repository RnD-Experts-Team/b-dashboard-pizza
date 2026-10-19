import { NextRequest, NextResponse } from "next/server";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Configuration                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Upstream auth API base URL.
 * Uses NEXT_PUBLIC_API_URL by convention; override with AUTH_API_URL for
 * a server-only value that isn't exposed to the browser.
 */
export const AUTH_API_URL =
  process.env.AUTH_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://auth.pnepizza.com/api/v1";

/** Upstream request timeout (default 15 s) */
export const AUTH_TIMEOUT_MS =
  Number(process.env.AUTH_TIMEOUT_MS) || 15_000;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Header helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/** Extract the raw Authorization header value */
export function getAuthorizationHeader(
  request: NextRequest,
): string | null {
  return request.headers.get("authorization");
}

/** Return a 401 response if there is no Authorization header */
export function requireAuthorization(request: NextRequest) {
  const authorization = getAuthorizationHeader(request);

  if (!authorization?.trim()) {
    return errorResponse(
      "NOT_AUTHENTICATED",
      "Missing authorization token",
      401,
    );
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Structured error responses                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export type AuthErrorCode =
  | "NOT_AUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "INVALID_REQUEST"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVICE_BUSY"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export function errorResponse(
  code: AuthErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
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
    },
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Fetch with timeout                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Whether a retry loop should try an upstream status again: 5xx only, and
 * never 503. A 503 (like a 429) means "overloaded, come back after
 * Retry-After", so retrying at once only multiplies the load; it goes back to
 * the caller as is.
 */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 && status !== 503;
}

/**
 * Wrapper around `fetch` that aborts after `timeoutMs` milliseconds.
 * Also respects the incoming Next.js request signal (client disconnect).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  requestSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the client disconnects, abort the upstream request too
  requestSignal?.addEventListener("abort", () => controller.abort(), {
    once: true,
  });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Upstream error mapping                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Map a failed upstream response to a structured error.
 * Reads the JSON body from the upstream to extract the original message,
 * but never leaks internal details in production.
 */
export async function mapUpstreamError(
  response: Response,
  fallbackMessage: string,
): Promise<NextResponse> {
  // Try to extract the upstream JSON error message
  let upstreamMessage: string | undefined;
  try {
    const body = await response.json();
    upstreamMessage = body?.message ?? body?.error?.message;
  } catch {
    /* ignore parse errors */
  }

  const message = upstreamMessage || fallbackMessage;

  switch (response.status) {
    case 401:
      return errorResponse("INVALID_CREDENTIALS", message, 401);

    case 403:
      return errorResponse("FORBIDDEN", message, 403);

    case 404:
      return errorResponse("NOT_FOUND", message, 404);

    case 422:
      return errorResponse("VALIDATION_ERROR", message, 422);

    case 429: {
      const retryAfter = response.headers.get("Retry-After");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      };
      if (retryAfter) headers["Retry-After"] = retryAfter;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED" as AuthErrorCode,
            message: message || "Too many requests. Please wait before trying again.",
            ...(retryAfter && { retryAfter: Number(retryAfter) || retryAfter }),
          },
        },
        { status: 429, headers },
      );
    }

    // The auth server is overloaded, not refusing the token: keep the status
    // and Retry-After so the client waits instead of logging the user out.
    case 503: {
      const retryAfter = response.headers.get("Retry-After");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      };
      if (retryAfter) headers["Retry-After"] = retryAfter;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SERVICE_BUSY" as AuthErrorCode,
            message: "The server is busy. Please try again in a moment.",
            ...(retryAfter && { retryAfter: Number(retryAfter) || retryAfter }),
          },
        },
        { status: 503, headers },
      );
    }

    default:
      return errorResponse(
        "UPSTREAM_ERROR",
        `Authentication service returned an error (${response.status}).`,
        502,
        process.env.NODE_ENV === "development"
          ? { upstreamStatus: response.status, upstreamMessage: message }
          : undefined,
      );
  }
}

/**
 * Map a network / timeout error to a structured error.
 */
export function mapFetchError(error: unknown): NextResponse {
  const message =
    error instanceof Error ? error.message : "Unknown network error";

  if (message.includes("abort") || message.includes("timed out")) {
    return errorResponse(
      "TIMEOUT",
      `The authentication server did not respond within ${AUTH_TIMEOUT_MS / 1_000}s. Please try again.`,
      504,
    );
  }

  return errorResponse(
    "NETWORK_ERROR",
    "Unable to reach the authentication server. Please check your connection and try again.",
    503,
  );
}
