import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";

/**
 * Upstream OperationsPizza (scheduling) base URL.
 *
 * Server-only by design: the browser talks to a same-origin route handler and
 * never learns where OperationsPizza lives. Prefers the private var, with a
 * public fallback so existing `.env` files keep working.
 *
 * The base ends at `/api`; every path below is appended as `/v1/...`.
 */
export const OPERATIONS_API_URL =
  process.env.OPERATIONS_API_URL ||
  process.env.NEXT_PUBLIC_OPERATIONS_API_URL ||
  "https://operationstesting.lcportal.cloud/api";

const TIMEOUT_MS = Number(process.env.OPERATIONS_TIMEOUT_MS) || 30_000;

interface ProxyOptions {
  method: string;
  /**
   * Read the request body and forward it untouched, with the caller's own
   * Content-Type. Required for the multipart publish endpoint — see below.
   */
  forwardBody?: boolean;
}

/**
 * Forward a scheduling request upstream and mirror the response verbatim.
 *
 * Mirroring the body unchanged is what lets the client branch on the API's own
 * `error.code` and show the API's own `message`. Only transport failures get a
 * synthesized envelope, and those are shaped like the rest of this repo
 * (`{ success: false, error: { code, message } }`) — the client error parser
 * handles both shapes deliberately.
 *
 * Three things here are load-bearing:
 *
 * 1. Content-Type is only ever set from the caller's own header. The publish
 *    endpoint is `multipart/form-data`, and hardcoding `application/json` would
 *    destroy the boundary and deliver an empty upload.
 *
 * 2. The query string is forwarded. `week_start`, `mode`, `department`,
 *    `search`, `confirm`, `page` and `per_page` all travel there.
 *
 * 3. Mutating requests are NOT aborted when the client disconnects. A shift
 *    create that is cancelled mid-flight may already have been written to
 *    Humanity, and the local row would never be recorded.
 */
export async function proxyScheduling(
  request: NextRequest,
  upstreamPath: string,
  { method, forwardBody = false }: ProxyOptions
): Promise<NextResponse> {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { search } = new URL(request.url);
  const url = `${OPERATIONS_API_URL}/v1${upstreamPath}${search}`;

  // Connection: close avoids reusing a pooled keep-alive socket the Laravel
  // backend may already have closed, which surfaces as ECONNRESET even though
  // the request was processed. Same reasoning as the inventory proxy.
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: authorization,
    Connection: "close",
  };

  let body: ArrayBuffer | undefined;
  if (forwardBody) {
    // Pass the body through as raw bytes. Reading it as an ArrayBuffer keeps
    // multipart intact, because the boundary lives in Content-Type, which we
    // forward verbatim rather than inventing.
    const contentType = request.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;
    body = await request.arrayBuffer();
  }

  const upstreamSignal = method === "GET" ? request.signal : undefined;

  try {
    const upstream = await fetchWithTimeout(
      url,
      forwardBody ? { method, headers, body } : { method, headers },
      TIMEOUT_MS,
      upstreamSignal
    );

    let text = "";
    try {
      text = await upstream.text();
    } catch {
      // Body stream closed early — still forward the status.
    }

    // 204 carries no body; NextResponse.json() would fabricate one.
    return new NextResponse(text || null, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
        // Surface upstream backoff so the client can honour it on a 503.
        ...(upstream.headers.get("Retry-After")
          ? { "Retry-After": upstream.headers.get("Retry-After")! }
          : {}),
      },
    });
  } catch (err) {
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      return errorResponse(
        "TIMEOUT",
        "The scheduling service did not respond in time. Nothing was changed — please try again.",
        504
      );
    }

    // NOTE: the inventory proxy answers a failed DELETE with 204, assuming the
    // backend committed. That is deliberately NOT done here. A shift only exists
    // locally because a write to Humanity succeeded, so reporting a delete that
    // may not have happened would leave a shift invisible to managers but still
    // live for the employee — the worst divergence this system can produce.
    // Report the failure and let the client refetch the week instead.
    return errorResponse(
      "UPSTREAM_ERROR",
      "Could not reach the scheduling service. Nothing was changed.",
      502
    );
  }
}
