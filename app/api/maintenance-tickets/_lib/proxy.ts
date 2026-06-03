import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

export const BASE_URL =
  process.env.NEW_MAINTENANCE_API_URL ||
  process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL ||
  "https://maintenance.lcportal.cloud";

const TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
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
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function authorizationOrError(request: NextRequest):
  | { authorization: string }
  | { error: NextResponse } {
  const authError = requireAuthorization(request);
  if (authError) return { error: authError };
  const authorization = getAuthorizationHeader(request);
  if (!authorization) {
    return { error: errorJson("NOT_AUTHENTICATED", "Missing authorization token", 401) };
  }
  return { authorization };
}

export async function proxyGet(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "GET",
      headers: { Authorization: auth.authorization, Accept: "application/json" },
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}

export async function proxyDelete(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "DELETE",
      headers: { Authorization: auth.authorization, Accept: "application/json" },
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
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
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}

export async function proxyRawPost(request: NextRequest, upstreamUrl: string) {
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;

  const contentType = request.headers.get("content-type") || "application/octet-stream";
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
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) {
      return errorJson("TIMEOUT", "Upstream request timed out", 504);
    }
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}
