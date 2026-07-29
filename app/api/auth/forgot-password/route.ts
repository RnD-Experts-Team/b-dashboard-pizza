import { NextRequest } from "next/server";
import {
  AUTH_API_URL,
  AUTH_TIMEOUT_MS,
  errorResponse,
  fetchWithTimeout,
  mapUpstreamError,
  mapFetchError,
} from "@/app/api/_lib/auth";
import { checkRateLimit, getClientIp } from "@/app/api/_lib/rate-limit";
import { NextResponse } from "next/server";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordBody {
  email?: unknown;
}

function validateBody(body: ForgotPasswordBody): { email: string } | string {
  const { email } = body;

  if (!email || typeof email !== "string") {
    return "Email is required.";
  }
  if (!EMAIL_RE.test(email)) {
    return "Please enter a valid email address.";
  }

  return { email: email.trim().toLowerCase() };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Generic response (email enumeration protection)                        */
/* ────────────────────────────────────────────────────────────────────────── */

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for this email, we've sent a verification code.";

function genericSuccessResponse() {
  return NextResponse.json(
    { success: true, message: GENERIC_SUCCESS_MESSAGE },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/auth/forgot-password                                         */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Requests a password-reset OTP from the upstream auth API.
 *
 * The response is intentionally masked: whether the email exists or not,
 * the caller always sees the same generic "check your email" message. Only
 * genuine infrastructure failures (timeout/network/5xx) or rate limiting
 * are surfaced as real errors — those aren't enumeration signals and the
 * user needs to know to retry.
 */
export async function POST(request: NextRequest) {
  let body: ForgotPasswordBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const result = validateBody(body);
  if (typeof result === "string") {
    return errorResponse("VALIDATION_ERROR", result, 422);
  }
  const { email } = result;

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`forgot-password:${ip}:${email}`, {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait before trying again.",
          retryAfter: rateLimit.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const targetUrl = `${AUTH_API_URL}/auth/forgot-password`;
  console.log(`🔑 Auth Proxy → POST ${targetUrl} (${email})`);

  try {
    const response = await fetchWithTimeout(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      },
      AUTH_TIMEOUT_MS,
      request.signal
    );

    console.log(`🔑 Auth Proxy ← ${response.status}`);

    // Success, "not found", or validation-style errors all mask to the
    // same generic message — none of these should tell the caller
    // whether the email is registered.
    if (response.ok || response.status === 404 || response.status === 422) {
      return genericSuccessResponse();
    }

    // Rate limiting and genuine infra errors are surfaced for real.
    return await mapUpstreamError(response, "Unable to process request.");
  } catch (error) {
    console.error(
      "❌ Auth Proxy forgot-password error:",
      error instanceof Error ? error.message : error
    );
    return mapFetchError(error);
  }
}
