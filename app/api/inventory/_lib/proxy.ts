import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";

/**
 * Upstream inventory backend base URL. Prefers a server-only override; falls
 * back to the existing public var (and its previous default) so current
 * `.env` files keep working unchanged.
 */
export const INVENTORY_API_URL =
  process.env.INVENTORY_API_URL ||
  process.env.NEXT_PUBLIC_INVENTORY_API_URL ||
  "https://inventorytesting.lcportal.cloud/api";

const TIMEOUT_MS = 30_000;

interface ProxyOptions {
  method: string;
  /** Attach the caller's Bearer token upstream. Set false for public/no-auth endpoints. */
  auth?: boolean;
  /** Read the request body and forward it (JSON or multipart) with its Content-Type. */
  forwardBody?: boolean;
}

/**
 * Forward an inventory request to the Laravel backend and mirror its response
 * verbatim (status + body). This keeps `lib/api/inventory-errors.ts`'s existing
 * `{ message, errors }` parsing working unchanged for real backend errors (422,
 * 404, etc.) — only network/timeout failures get a synthesized error envelope.
 */
export async function proxyInventory(
  request: NextRequest,
  upstreamPath: string,
  { method, auth = true, forwardBody = false }: ProxyOptions
): Promise<NextResponse> {
  let authorization: string | null = null;
  if (auth) {
    const authError = requireAuthorization(request);
    if (authError) return authError;
    authorization = getAuthorizationHeader(request);
  }

  const { search } = new URL(request.url);
  const url = `${INVENTORY_API_URL}${upstreamPath}${search}`;

  // Connection: close prevents Node.js from reusing a pooled keep-alive socket
  // that the backend (keep-alive: timeout=5) may have already closed — which
  // would cause ECONNRESET even though the backend processed the request.
  const headers: Record<string, string> = {
    Accept: "application/json",
    Connection: "close",
  };
  if (authorization) headers.Authorization = authorization;

  let body: ArrayBuffer | undefined;
  if (forwardBody) {
    headers["Content-Type"] =
      request.headers.get("content-type") || "application/json";
    body = await request.arrayBuffer();
  }

  // Only propagate client-disconnect signal for GET — mutating ops must not be
  // aborted mid-flight because the backend may have already committed the change
  // before the response arrives.
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
      // Body stream closed before completion — still forward the status.
    }

    return new NextResponse(text, {
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
      return errorResponse("TIMEOUT", "Upstream request timed out", 504);
    }

    // DELETE: if the connection drops after the request was sent the backend
    // likely processed it (ECONNRESET race with keep-alive timeout). Return 204
    // so the client removes the item from the UI instead of showing an error.
    if (method === "DELETE") {
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return errorResponse(
      "UPSTREAM_ERROR",
      "Failed to reach the inventory service",
      502
    );
  }
}
