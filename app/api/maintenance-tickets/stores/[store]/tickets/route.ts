import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
} from "@/app/api/_lib/auth";

const BASE_URL =
  process.env.NEW_MAINTENANCE_API_URL ||
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);

  const authorization = getAuthorizationHeader(request)!;
  const { searchParams } = new URL(request.url);

  // Forward filter params to upstream
  const forwardParams = new URLSearchParams();

  const SCALAR_KEYS = [
    "created_from", "created_to", "assigned_from", "assigned_to",
    "part_cost_single_gt", "part_cost_total_gt",
    "trashed", "sort", "dir", "page", "per_page",
  ];
  const ARRAY_KEYS = [
    "statuses[]", "priorities[]", "issue_ids[]",
    "issue_statuses[]", "technician_ids[]", "types[]",
  ];

  for (const key of SCALAR_KEYS) {
    const v = searchParams.get(key);
    if (v) forwardParams.set(key, v);
  }
  for (const key of ARRAY_KEYS) {
    searchParams.getAll(key).forEach((v) => forwardParams.append(key, v));
  }

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets${forwardParams.toString() ? `?${forwardParams}` : ""}`;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { store } = await params;
  if (!store) return errorJson("MISSING_PARAM", "store is required", 400);

  const authorization = getAuthorizationHeader(request)!;
  // Forward the raw body and its Content-Type (including the multipart boundary)
  // so the upstream can parse the multipart/form-data correctly.
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";
  const body = await request.arrayBuffer();

  const upstreamUrl = `${BASE_URL}/stores/${encodeURIComponent(store)}/tickets`;

  try {
    const res = await fetchWithTimeout(upstreamUrl, {
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
