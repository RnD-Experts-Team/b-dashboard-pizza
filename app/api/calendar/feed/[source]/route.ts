import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";
import { isFeedSource } from "@/lib/calendar/feed-types";
import { feedUrl, sourceConfig } from "@/app/api/calendar/_lib/sources";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = Number(process.env.CALENDAR_FEED_TIMEOUT_MS) || 15_000;

/**
 * GET /api/calendar/feed/{source}?stores=03795-00001,…&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * The dashboard's gateway to the 8 calendar feeds (`calendar-feed/v1`). The
 * browser can't reach the services directly (no CORS), so this forwards the
 * call with the user's own token and mirrors the answer verbatim.
 *
 * - `source` is checked against a fixed list, so the URL can never choose a host.
 * - The query string goes upstream AS-IS (guide §2): `stores`, `from`, `to`
 *   today, and `types[]` / `statuses[]` / `expand` / `group` once they're built.
 * - Store access is decided upstream by pizzasys from that same query, so no
 *   store check happens here.
 * - Status and body are passed through, so the client can tell a 403 (no
 *   access to this layer — hide it) from a failure (show "couldn't load").
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { source } = await params;
  if (!isFeedSource(source)) {
    return errorResponse("NOT_FOUND", `Unknown calendar source: ${source}`, 404);
  }

  const { label, envNames } = sourceConfig(source);
  const upstreamUrl = feedUrl(source);
  if (!upstreamUrl) {
    // Not an AuthErrorCode, so built by hand in the same envelope shape.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "CONFIG_MISSING",
          message: `The ${label} calendar feed is not configured (${envNames} is missing).`,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { search } = new URL(request.url);

  try {
    const upstream = await fetchWithTimeout(
      `${upstreamUrl}${search}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: getAuthorizationHeader(request)!,
          // Avoid reusing a pooled keep-alive socket Laravel may have closed.
          Connection: "close",
        },
        cache: "no-store",
      },
      TIMEOUT_MS,
      request.signal,
    );

    let text = "";
    try {
      text = await upstream.text();
    } catch {
      // Body stream closed early — still forward the status.
    }

    return new NextResponse(upstream.status === 204 ? null : text || null, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      return errorResponse("TIMEOUT", `The ${label} calendar feed did not respond in time.`, 504);
    }
    return errorResponse("UPSTREAM_ERROR", `Could not reach the ${label} calendar feed.`, 502);
  }
}
