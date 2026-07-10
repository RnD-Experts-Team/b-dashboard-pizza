import { NextRequest } from "next/server";
import {
  AUTH_API_URL,
  AUTH_TIMEOUT_MS,
  requireAuthorization,
  getAuthorizationHeader,
  errorResponse,
  fetchWithTimeout,
  mapUpstreamError,
  mapFetchError,
} from "@/app/api/_lib/auth";

/* ────────────────────────────────────────────────────────────────────────── */
/*  POST /api/auth/impersonate/:userId                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Production proxy — starts an impersonation session for the given user.
 * The upstream API is responsible for verifying the caller is authorized
 * to impersonate (e.g. is a super admin); this route only forwards the
 * caller's Bearer token, same as every other proxy route in this app.
 *
 * Features:
 *  - Forwards the client's Bearer token to the upstream auth API
 *  - Structured error responses
 *  - Timeout handling
 *  - Never caches the response (it contains a bearer token)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const startTime = Date.now();

  // ── Auth check ───────────────────────────────────────────────────────
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { userId } = await params;

  if (!userId?.trim()) {
    return errorResponse("INVALID_REQUEST", "A userId is required.", 400);
  }

  const targetUrl = `${AUTH_API_URL}/auth/impersonate/${encodeURIComponent(userId)}`;

  console.log(`🎭 Auth Proxy → POST ${targetUrl}`);

  // ── Forward to upstream ──────────────────────────────────────────────
  try {
    const response = await fetchWithTimeout(
      targetUrl,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
        },
      },
      AUTH_TIMEOUT_MS,
      request.signal,
    );

    const elapsed = Date.now() - startTime;
    console.log(`🎭 Auth Proxy ← ${response.status} (${elapsed}ms)`);

    // ── Success ──────────────────────────────────────────────────────
    if (response.ok) {
      const data = await response.text();

      try {
        JSON.parse(data);
      } catch {
        return errorResponse(
          "UPSTREAM_ERROR",
          "Authentication server returned invalid data.",
          502,
        );
      }

      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Response-Time": `${elapsed}ms`,
        },
      });
    }

    // ── Upstream error ───────────────────────────────────────────────
    return await mapUpstreamError(response, "Failed to start impersonation.");
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(
      `❌ Auth Proxy impersonate error (${elapsed}ms):`,
      error instanceof Error ? error.message : error,
    );
    return mapFetchError(error);
  }
}
