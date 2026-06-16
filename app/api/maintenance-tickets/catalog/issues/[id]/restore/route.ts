import { NextRequest, NextResponse } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";

const BASE_URL =
  process.env.NEW_MAINTENANCE_API_URL ||
  process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL ||
  "https://maintenance.lcportal.cloud";

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
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

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authError = requireAuthorization(request);
  if (authError) return authError;
  const authorization = getAuthorizationHeader(request)!;
  const { id } = await params;

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/issues/${id}/restore`, {
      method: "POST",
      headers: { Authorization: authorization, Accept: "application/json" },
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) return errorJson("TIMEOUT", "Upstream request timed out", 504);
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}
