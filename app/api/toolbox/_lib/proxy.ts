import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";
import { TOOLBOX_MOCK, mockToolbox } from "./mock";

/**
 * Upstream ToolboxPizza base URL.
 *
 * Unlike most upstreams in this repo, the env value already ends in `/api/v1`,
 * so paths below are appended directly — never add another `/v1`.
 *
 * There is no hardcoded fallback on purpose: nobody has published a stable
 * production host, and silently pointing at a guessed one would record a
 * user's breaks somewhere they can never be read back from.
 */
const TOOLBOX_API_URL = (
  process.env.TOOLBOX_API_URL ||
  process.env.NEXT_PUBLIC_TOOLBOX_API_URL ||
  ""
).replace(/\/+$/, "");

const TIMEOUT_MS = Number(process.env.TOOLBOX_TIMEOUT_MS) || 30_000;

interface ProxyOptions {
  method: "GET" | "POST" | "DELETE";
  forwardBody?: boolean;
}

/**
 * Forward a toolbox request upstream and mirror the response verbatim, so the
 * client can branch on the API's own `error.code` (and read `error.running`,
 * `error.conflicts`, `errors.{field}`) exactly as documented.
 *
 * Caching is disabled at every layer: `GET breaks/active` and `GET breaks/day`
 * WRITE rows (milestone evaluation runs on read), so a cached or prefetched
 * response would both hide state and fire notifications at the wrong time.
 */
export async function proxyToolbox(
  request: NextRequest,
  upstreamPath: string,
  { method, forwardBody = false }: ProxyOptions
): Promise<NextResponse> {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  // Demo data while ToolboxPizza isn't live (TOOLBOX_MOCK=true); set it to
  // false to use the live TOOLBOX_API_URL.
  if (TOOLBOX_MOCK) return mockToolbox(request, upstreamPath, method);

  if (!TOOLBOX_API_URL) {
    // Not an AuthErrorCode, so built by hand in the same envelope shape.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONFIG_MISSING",
          message: "The breaks service is not configured (TOOLBOX_API_URL is missing).",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const authorization = getAuthorizationHeader(request)!;
  const { search } = new URL(request.url);
  const url = `${TOOLBOX_API_URL}${upstreamPath}${search}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: authorization,
    // Avoid reusing a pooled keep-alive socket Laravel may have closed.
    Connection: "close",
  };

  let body: ArrayBuffer | undefined;
  if (forwardBody) {
    headers["Content-Type"] =
      request.headers.get("content-type") || "application/json";
    body = await request.arrayBuffer();
  }

  // Only reads are aborted when the client goes away: a start/stop that is
  // cancelled mid-flight may already have been committed upstream.
  const upstreamSignal = method === "GET" ? request.signal : undefined;

  try {
    const upstream = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        cache: "no-store",
        ...(forwardBody ? { body } : {}),
      },
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
    return new NextResponse(upstream.status === 204 ? null : text || null, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      return errorResponse(
        "TIMEOUT",
        "The breaks service did not respond in time. Please try again.",
        504
      );
    }
    return errorResponse(
      "UPSTREAM_ERROR",
      "Could not reach the breaks service.",
      502
    );
  }
}

/** Path segment helper — ids come from the URL and are never trusted raw. */
export function seg(value: string): string {
  return encodeURIComponent(value);
}
