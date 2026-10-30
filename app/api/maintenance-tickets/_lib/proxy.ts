import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

export const BASE_URL =
  process.env.NEW_MAINTENANCE_API_URL ||
  process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL ||
  "https://maintenance.lcportal.cloud";

// Generous timeout to accommodate attachment uploads (photos, PDFs) on slow connections.
const TIMEOUT_MS = 120_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function errorJson(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function authorizationOrError(
  request: NextRequest,
): { authorization: string } | { error: NextResponse } {
  const authError = requireAuthorization(request);
  if (authError) return { error: authError };
  const authorization = getAuthorizationHeader(request);
  if (!authorization) {
    return {
      error: errorJson("NOT_AUTHENTICATED", "Missing authorization token", 401),
    };
  }
  return { authorization };
}

export async function proxyGet(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "GET",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
      },
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

export async function proxyDelete(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "DELETE",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
      },
    });
    if (res.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

export async function proxyJsonPost(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("INVALID_REQUEST", "Invalid JSON body", 400);
  }

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

export async function proxyJsonPatch(
  request: NextRequest,
  upstreamUrl: string,
) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("INVALID_REQUEST", "Invalid JSON body", 400);
  }

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "PATCH",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

/**
 * PUT, for the endpoints that replace a whole resource rather than patch it.
 *
 * Added alongside PATCH rather than folded into it: the distinction is load
 * bearing upstream. Setting a part's place sends the COMPLETE address, and a
 * level left out is cleared -- which is a PUT, and would be a lie as a PATCH.
 */
export async function proxyJsonPut(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("INVALID_REQUEST", "Invalid JSON body", 400);
  }

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "PUT",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

export async function proxyRawPost(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  const contentType =
    request.headers.get("content-type") || "application/octet-stream";
  const body = await request.arrayBuffer();

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: auth.authorization,
        Accept: "application/json",
        "Content-Type": contentType,
      },
      body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Maintenance v2: generic passthrough for the catch-all route handlers     */
/* ────────────────────────────────────────────────────────────────────────── */

const BODYLESS = new Set(["GET", "HEAD", "DELETE"]);

/**
 * Forwards the request as it came: method, query string, and body bytes with
 * their content type (so a multipart boundary survives). Used by the v2
 * catch-all routes (trips, payments, stock counts…), where one handler serves
 * a whole area and a per-method helper would only repeat itself.
 *
 * `auth: false` is ONLY for the public trip link: no Authorization header is
 * read or sent, the token in the path is the credential.
 */
export async function proxyPassthrough(
  request: NextRequest,
  upstreamUrl: string,
  opts: { auth?: boolean } = {},
): Promise<NextResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (opts.auth !== false) {
    const auth = authorizationOrError(request);
    if ("error" in auth) return auth.error;
    headers.Authorization = auth.authorization;
  }

  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (!BODYLESS.has(method)) {
    body = await request.arrayBuffer();
    headers["Content-Type"] =
      request.headers.get("content-type") || "application/json";
  }

  try {
    const res = await fetchWithTimeout(upstreamUrl, { method, headers, body });
    if (res.status === 204) {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson(
      "NETWORK_ERROR",
      "Failed to reach maintenance service",
      502,
    );
  }
}

/**
 * Builds `${BASE_URL}/<prefix>/<segments…>?<query>` from a catch-all route's
 * segments, encoding each segment and forwarding the query string verbatim
 * (repeated `stores[]` keys stay intact).
 */
export function upstreamFromSegments(
  request: NextRequest,
  prefix: string,
  segments: string[] | undefined,
): string {
  const path = [prefix, ...(segments ?? []).map((s) => encodeURIComponent(s))]
    .filter(Boolean)
    .join("/");
  const qs = new URL(request.url).search;
  return `${BASE_URL}/${path}${qs}`;
}

/** Rejects a path segment that could walk out of the area ("..", empty). */
export function hasUnsafeSegment(segments: string[] | undefined): boolean {
  return (segments ?? []).some((s) => !s || s === "." || s === ".." || s.includes("/"));
}
