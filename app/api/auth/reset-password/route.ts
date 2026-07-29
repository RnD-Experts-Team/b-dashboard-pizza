import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_API_URL,
  AUTH_TIMEOUT_MS,
  errorResponse,
  fetchWithTimeout,
  mapUpstreamError,
  mapFetchError,
} from "@/app/api/_lib/auth";
import { checkRateLimit, getClientIp } from "@/app/api/_lib/rate-limit";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Validation                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;

interface ResetPasswordBody {
  email?: unknown;
  password?: unknown;
  password_confirmation?: unknown;
  otp?: unknown;
}

function validateBody(
  body: ResetPasswordBody
):
  | { email: string; password: string; password_confirmation: string; otp: string }
  | string {
  const { email, password, password_confirmation, otp } = body;

  if (!email || typeof email !== "string") {
    return "Email is required.";
  }
  if (!EMAIL_RE.test(email)) {
    return "Please enter a valid email address.";
  }
  if (!otp || typeof otp !== "string") {
    return "Verification code is required.";
  }
  if (!OTP_RE.test(otp)) {
    return "Verification code must be 6 digits.";
  }
  if (!password || typeof password !== "string") {
    return "Password is required.";
  }
  if (!password_confirmation || typeof password_confirmation !== "string") {
    return "Password confirmation is required.";
  }
  if (password !== password_confirmation) {
    return "Passwords do not match.";
  }

  return {
    email: email.trim().toLowerCase(),
    password,
    password_confirmation,
    otp,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/auth/reset-password                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  let body: ResetPasswordBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const result = validateBody(body);
  if (typeof result === "string") {
    return errorResponse("VALIDATION_ERROR", result, 422);
  }
  const { email, password, password_confirmation, otp } = result;

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`reset-password:${ip}:${email}`, {
    max: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts. Please wait before trying again.",
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

  const targetUrl = `${AUTH_API_URL}/auth/reset-password`;
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
        body: JSON.stringify({ email, password, password_confirmation, otp }),
      },
      AUTH_TIMEOUT_MS,
      request.signal
    );

    console.log(`🔑 Auth Proxy ← ${response.status}`);

    if (response.ok) {
      const data = await response.text();
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    if (response.status === 401) {
      return errorResponse(
        "INVALID_CREDENTIALS",
        "That code is invalid or has expired. Please try again or request a new one.",
        401
      );
    }

    return await mapUpstreamError(response, "Password reset failed.");
  } catch (error) {
    console.error(
      "❌ Auth Proxy reset-password error:",
      error instanceof Error ? error.message : error
    );
    return mapFetchError(error);
  }
}
