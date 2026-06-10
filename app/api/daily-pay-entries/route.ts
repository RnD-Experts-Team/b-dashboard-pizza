import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL ||
  "https://maintenance.lcportal.cloud";

const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function errorJson(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const upstreamUrl = `${BASE_URL}/daily-pay-entries${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
      method: "GET",
      headers: { Authorization: authorization, Accept: "application/json" },
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

export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const body = await request.arrayBuffer();

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/daily-pay-entries`, {
      method: "POST",
      headers: {
        Authorization: authorization,
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
