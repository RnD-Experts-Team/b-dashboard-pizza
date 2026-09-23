import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/app/api/_lib/auth";

/**
 * Shared upstream plumbing for the HiringPizza BFF routes.
 *
 * The shirt-milestone feature alone adds 17 route files / 21 operations. The
 * per-route copy-paste convention does not scale to that: one of them would
 * forget the 204 null-body guard and 500 on a catalog DELETE. This is the same
 * kind of server-only `_lib` module as `auth.ts` — `_`-prefixed folders are
 * excluded from App Router routing — and route files still import
 * `requireAuthorization` / `getAuthorizationHeader` / `errorResponse` from there
 * exactly as before.
 */

export const HIRING_BASE_URL =
  process.env.HIRING_API_URL ||
  process.env.NEXT_PUBLIC_HIRING_API_URL ||
  "https://hiring.lcportal.cloud/api";

export const UPSTREAM_TIMEOUT_MS = Number(process.env.HIRING_TIMEOUT_MS) || 15_000;

/** `upstreamPath` is everything after /v1, e.g. "/stores/03759-00001/shirt-milestones". */
function upstreamUrl(upstreamPath: string): string {
  return `${HIRING_BASE_URL}/v1${upstreamPath}`;
}

/**
 * The one place an upstream request is actually made. Everything else in this
 * file funnels through it, so timeouts, 502s and null bodies behave the same
 * on every route.
 */
export async function proxyFetch(
  url: string,
  init: RequestInit,
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);

    // 204/205/304 must not carry a body — the Response constructor throws
    // otherwise. All three catalog DELETEs return 204.
    const isNullBody =
      upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
    const body = isNullBody ? null : await upstream.text();

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse("UPSTREAM_ERROR", "Failed to reach hiring service", 502);
  }
}

/**
 * GET with the incoming query string forwarded verbatim.
 *
 * `append`, not `set`: the queues send repeated `statuses[]` and `stores[]`
 * params and the backend validates them as arrays, so collapsing duplicates
 * would silently drop filters. No key allow-listing — pass everything through
 * and let a bad param surface as the upstream's own 422.
 */
export async function proxyQuery(
  request: NextRequest,
  authorization: string,
  upstreamPath: string,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = new URL(upstreamUrl(upstreamPath));
  searchParams.forEach((value, key) => url.searchParams.append(key, value));

  return proxyFetch(url.toString(), {
    method: "GET",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
}

/**
 * JSON passthrough. Reads `request.text()` rather than `.json()` so an empty
 * body stays legal — POST /deliver takes an optional body.
 */
export async function proxyJson(
  request: NextRequest,
  authorization: string,
  upstreamPath: string,
  method: "POST" | "PUT" | "PATCH",
): Promise<NextResponse> {
  const body = await request.text();

  return proxyFetch(upstreamUrl(upstreamPath), {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body || "{}",
  });
}

/**
 * multipart/form-data passthrough for the logo and template uploads.
 *
 * Forwards the raw bytes and the incoming Content-Type verbatim so the
 * multipart boundary survives — re-parsing and rebuilding the form here would
 * lose it. Same approach as the maintenance-tickets upload route.
 */
export async function proxyMultipart(
  request: NextRequest,
  authorization: string,
  upstreamPath: string,
  method: "POST" = "POST",
): Promise<NextResponse> {
  const contentType =
    request.headers.get("content-type") ?? "application/octet-stream";
  const body = await request.arrayBuffer();

  return proxyFetch(upstreamUrl(upstreamPath), {
    method,
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": contentType,
    },
    body,
  });
}
