import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  getAuthorizationHeader,
  requireAuthorization,
} from "@/app/api/_lib/auth";

/**
 * Shared upstream plumbing for the Announcements BFF routes.
 *
 * Every route under app/api/announcements/** calls `proxyNotifications`, so
 * timeouts, null bodies, Retry-After and the 504/502 mapping behave the same
 * everywhere. `_`-prefixed folders are not routed by the App Router. Same shape
 * as `app/api/_lib/hiring-proxy.ts`.
 *
 * The upstream body and status are passed through verbatim: the frontend reads
 * Laravel's own `{ message, errors }` and `Retry-After`.
 */

export const NOTIFICATIONS_BASE_URL =
  process.env.NOTIFICATIONS_API_URL ||
  process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL ||
  "https://notifications.lcportal.cloud/api";

/**
 * The most request-body bytes a route reads before it answers 413. The body is
 * buffered here before the upstream checks the token, so without a cap anyone
 * could send gigabytes at an announcement route.
 */
export const DEFAULT_JSON_MAX_BYTES = 1024 * 1024; // 1 MB: text, comments, likes
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024; // the 10 MB image plus the multipart wrapping
export const CHUNK_MAX_BYTES = 8 * 1024 * 1024; // a video chunk (the app sends 2 MB)

/** Plain requests. */
export const DEFAULT_TIMEOUT_MS =
  Number(process.env.NOTIFICATIONS_TIMEOUT_MS) || 15_000;

/**
 * Image and video-chunk uploads. Only the hop from this server to Notifications:
 * the browser's own upload is over by then (the body is read first).
 */
export const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Upstream path of ONE comment (delete / like).
 *
 * OPEN QUESTION 1 (docs/ANNOUNCEMENTS.md): the backend contract documents this
 * as `/announcements/announcement/comments/{id}` with a literal `announcement`
 * segment, which looks like a placeholder that was never replaced. The local
 * routes are nested under `[id]/comments/[commentId]` so the announcement id is
 * still available here if the real path turns out to be
 * `/announcements/{announcement}/comments/{id}`. This is the ONLY place that
 * literal appears. Change it here.
 */
export const COMMENT_UPSTREAM = (commentId: string): string =>
  `/announcements/announcement/comments/${encodeURIComponent(commentId)}`;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Path-param validation                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** 1, 2, 3 … (no sign, no leading zero, at most 10 digits). */
export function isPositiveIntParam(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value);
}

/** 0, 1, 2 … (a chunk index). */
export function isNonNegativeIntParam(value: string): boolean {
  return /^(?:0|[1-9]\d{0,5})$/.test(value);
}

export function isUuidParam(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** A 400 for a bad path param, in this repo's error envelope. */
export function invalidParam(name: string): NextResponse {
  return errorResponse("INVALID_REQUEST", `Invalid ${name}`, 400);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The proxy                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ProxyOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /**
   * What the request carries.
   *  - "none": no body (GET, DELETE, like toggles)
   *  - "json": a JSON body, forwarded as sent
   *  - "multipart": raw bytes and the incoming Content-Type (with its boundary)
   */
  body?: "none" | "json" | "multipart";
  /** Query keys to forward (an allowlist). Omitted = no query is forwarded. */
  query?: readonly string[];
  timeoutMs?: number;
  /** Body bytes accepted before 413. Defaults: JSON 1 MB, multipart 12 MB. */
  maxBytes?: number;
  /** Looks at the parsed JSON body; return a message to refuse it with a 400. */
  validateJson?: (data: unknown) => string | null;
}

/**
 * The request body, or null when it is over `maxBytes`. The declared
 * Content-Length is checked first; the stream is then counted anyway, because a
 * chunked request declares nothing.
 */
async function readBodyLimited(request: NextRequest, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }

  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  return all;
}

const TOO_LARGE = () => errorResponse("INVALID_REQUEST", "The request is too large", 413);

/** 204 / 205 / 304 must not carry a body: the Response constructor throws otherwise. */
function isNullBodyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

/**
 * Forward `request` to `{NOTIFICATIONS_BASE_URL}{upstreamPath}` with the
 * caller's bearer token.
 *
 * `upstreamPath` starts with "/" and must already be built from VALIDATED
 * params (use `isPositiveIntParam` / `isUuidParam` and `encodeURIComponent`).
 */
export async function proxyNotifications(
  request: NextRequest,
  upstreamPath: string,
  options: ProxyOptions,
): Promise<NextResponse> {
  const authError = requireAuthorization(request);
  if (authError) return authError;
  const authorization = getAuthorizationHeader(request)!;

  const { method, body: bodyKind = "none", query, timeoutMs } = options;
  const timeout =
    timeoutMs ?? (bodyKind === "multipart" ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  const url = new URL(`${NOTIFICATIONS_BASE_URL}${upstreamPath}`);
  if (query?.length) {
    const incoming = new URL(request.url).searchParams;
    for (const key of query) {
      // `append`: a repeated key stays repeated.
      for (const value of incoming.getAll(key)) url.searchParams.append(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: authorization,
    Accept: "application/json",
  };
  let body: string | ArrayBuffer | undefined;

  if (bodyKind === "json") {
    const raw = await readBodyLimited(request, options.maxBytes ?? DEFAULT_JSON_MAX_BYTES);
    if (raw === null) return TOO_LARGE();
    let text: string;
    let parsed: unknown;
    try {
      text = new TextDecoder().decode(raw);
      parsed = JSON.parse(text);
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid JSON body", 400);
    }
    const problem = options.validateJson?.(parsed);
    if (problem) return errorResponse("INVALID_REQUEST", problem, 400);
    headers["Content-Type"] = "application/json";
    body = text;
  } else if (bodyKind === "multipart") {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return errorResponse("INVALID_REQUEST", "Expected multipart/form-data body", 400);
    }
    // Forward the bytes as they came; the boundary is in the Content-Type.
    // No parsing and rebuilding the form for every chunk.
    let raw: Uint8Array | null;
    try {
      raw = await readBodyLimited(request, options.maxBytes ?? IMAGE_MAX_BYTES);
    } catch {
      return errorResponse("INVALID_REQUEST", "Could not read the request body", 400);
    }
    if (raw === null) return TOO_LARGE();
    body = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    headers["Content-Type"] = contentType;
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body,
      // Stop when the browser gives up (it will retry) or the time is up.
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]),
    });

    const responseHeaders: Record<string, string> = {
      "Cache-Control": "no-store",
    };
    // Laravel's 429 / 503 tell the client when to come back.
    const retryAfter = upstream.headers.get("Retry-After");
    if (retryAfter) responseHeaders["Retry-After"] = retryAfter;

    if (isNullBodyStatus(upstream.status)) {
      return new NextResponse(null, { status: upstream.status, headers: responseHeaders });
    }

    const text = await upstream.text();
    const contentType = upstream.headers.get("Content-Type") ?? "";

    // Only JSON goes through. An HTML page from upstream (a debug stack trace, a
    // gateway error page) is replaced by a plain error and never shown or parsed.
    if (text !== "" && !/json/i.test(contentType)) {
      const failed = upstream.status >= 400;
      const replacement = errorResponse(
        "UPSTREAM_ERROR",
        failed
          ? "The notifications service answered with an error"
          : "The notifications service sent an unexpected answer",
        failed ? upstream.status : 502,
      );
      for (const [name, value] of Object.entries(responseHeaders)) {
        replacement.headers.set(name, value);
      }
      return replacement;
    }

    responseHeaders["Content-Type"] = contentType || "application/json";
    return new NextResponse(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    // `AbortSignal.timeout` rejects with TimeoutError, a client disconnect or
    // our own abort with AbortError. Both are "took too long / gave up".
    const name = (err as { name?: string } | null)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach notifications service",
      502,
    );
  }
}
