import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireAuthorization } from "@/app/api/_lib/auth";
import { TOOLBOX_MOCK_ENABLED, handleMockToolbox } from "@/app/api/toolbox/_lib/mock-toolbox";

/**
 * Shared upstream plumbing for the ToolboxPizza BFF routes (workbooks).
 *
 * Same shape as app/api/_lib/hiring-proxy.ts: one fetch path, one timeout, the
 * 204 null-body guard, and the upstream status + body passed back VERBATIM.
 * Verbatim matters here more than anywhere: the workbook API's errors carry
 * `error.code`, `error.capped_by`, `error.allowed` and the force-delete counts,
 * and the UI explains every refusal from those fields.
 *
 * TOOLBOX_API_URL already includes `/api/v1`.
 */

export const TOOLBOX_BASE_URL = (
  process.env.TOOLBOX_API_URL ||
  process.env.NEXT_PUBLIC_TOOLBOX_API_URL ||
  "https://toolboxtesting.lcportal.cloud/api/v1"
).replace(/\/+$/, "");

export const TOOLBOX_TIMEOUT_MS = Number(process.env.TOOLBOX_TIMEOUT_MS) || 20_000;

/** Store codes look like "03795-00001". Guard before they reach a URL. */
const STORE_CODE_RE = /^[a-zA-Z0-9_-]{1,32}$/;
/** Numeric ids only — anything else is a client bug, not an upstream 404. */
const ID_RE = /^\d{1,12}$/;

async function proxyFetch(url: string, init: RequestInit): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOOLBOX_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);

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
      return errorResponse("TIMEOUT", "The toolbox service took too long to answer.", 504);
    }
    // Server-side only: the cause (ENOTFOUND, ECONNREFUSED, a TLS failure) is
    // what you need to fix a wrong TOOLBOX_API_URL, and it never reaches the client.
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    console.error(
      `[toolbox-proxy] ${init.method} ${url} failed:`,
      cause?.code ?? cause?.message ?? (err instanceof Error ? err.message : err),
    );
    return errorResponse("UPSTREAM_ERROR", "Could not reach the toolbox service.", 502);
  }
}

/** Validate every dynamic segment; returns a 400 response on the first bad one. */
export function checkSegments(segments: {
  store?: string;
  ids?: string[];
}): NextResponse | null {
  if (segments.store !== undefined && !STORE_CODE_RE.test(segments.store)) {
    return errorResponse("INVALID_REQUEST", "Invalid store code.", 400);
  }
  for (const id of segments.ids ?? []) {
    if (!ID_RE.test(id)) {
      return errorResponse("INVALID_REQUEST", "Invalid id.", 400);
    }
  }
  return null;
}

/**
 * DEMO MODE (TOOLBOX_MOCK=true, never in production): answer from the
 * in-memory stand-in instead of the real host. Auth is still required, so the
 * page behaves exactly as it will live. `X-Toolbox-Mock` lets the UI say so.
 */
async function mockResponse(request: NextRequest, path: string, body = ""): Promise<NextResponse> {
  const result = await handleMockToolbox(request.method, path, request.nextUrl.searchParams, body);
  return new NextResponse(result.body === null ? null : JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Toolbox-Mock": "1",
    },
  });
}

function authHeader(request: NextRequest): string {
  return request.headers.get("authorization") ?? "";
}

/**
 * GET with the incoming query string forwarded verbatim. `append`, not `set`,
 * so `filter[40]=…` keys and repeated params survive untouched.
 */
export async function toolboxGet(request: NextRequest, path: string): Promise<NextResponse> {
  const denied = requireAuthorization(request);
  if (denied) return denied;
  if (TOOLBOX_MOCK_ENABLED) return mockResponse(request, path);

  const url = new URL(`${TOOLBOX_BASE_URL}${path}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  return proxyFetch(url.toString(), {
    method: "GET",
    headers: { Authorization: authHeader(request), Accept: "application/json" },
  });
}

/** JSON POST passthrough. Every update in this API is a POST. */
export async function toolboxPost(request: NextRequest, path: string): Promise<NextResponse> {
  const denied = requireAuthorization(request);
  if (denied) return denied;

  const body = await request.text();
  if (TOOLBOX_MOCK_ENABLED) return mockResponse(request, path, body);
  return proxyFetch(`${TOOLBOX_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(request),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body || "{}",
  });
}

/** DELETE, query string forwarded (folder delete takes `?force=true`). */
export async function toolboxDelete(request: NextRequest, path: string): Promise<NextResponse> {
  const denied = requireAuthorization(request);
  if (denied) return denied;
  if (TOOLBOX_MOCK_ENABLED) return mockResponse(request, path);

  const url = new URL(`${TOOLBOX_BASE_URL}${path}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  return proxyFetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: authHeader(request), Accept: "application/json" },
  });
}
