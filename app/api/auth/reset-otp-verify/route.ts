import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

interface VerifyOtpBody {
  email?: unknown;
  otp?: unknown;
}

function validateBody(body: VerifyOtpBody): { email: string; otp: string } | string {
  const { email, otp } = body;

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

  return { email: email.trim().toLowerCase(), otp };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/auth/reset-otp-verify                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  let body: VerifyOtpBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }

  const result = validateBody(body);
  if (typeof result === "string") {
    return errorResponse("VALIDATION_ERROR", result, 422);
  }
  const { email, otp } = result;

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`reset-otp-verify:${ip}:${email}`, {
    max: 5,
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

  const targetUrl = `${AUTH_API_URL}/auth/reset-otp-verify`;
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
        body: JSON.stringify({ email, otp }),
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

    // Keep the error generic — don't distinguish "wrong code" from
    // "expired code" to avoid giving an attacker a state oracle.
    if (response.status === 401 || response.status === 422) {
      return errorResponse(
        "INVALID_CREDENTIALS",
        "That code is invalid or has expired. Please try again or request a new one.",
        401
      );
    }

    return await mapUpstreamError(response, "Unable to verify code.");
  } catch (error) {
    console.error(
      "❌ Auth Proxy reset-otp-verify error:",
      error instanceof Error ? error.message : error
    );
    return mapFetchError(error);
  }
}
