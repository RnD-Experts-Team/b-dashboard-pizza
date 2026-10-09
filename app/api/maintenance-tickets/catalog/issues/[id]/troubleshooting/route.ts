import { NextRequest, NextResponse } from "next/server";
import { BASE_URL, authorizationOrError, errorJson, fetchWithTimeout, proxyJsonPost } from "@/app/api/maintenance-tickets/_lib/proxy";

type Params = { params: Promise<{ id: string }> };

/**
 * One catalog issue and all its troubleshooting guides -- the issue's
 * troubleshooting page. Forwards X-Store-Id so a store user's read can be
 * authorised against their store, as the library route does.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = authorizationOrError(request);
  if ("error" in auth) return auth.error;
  const storeId = request.headers.get("x-store-id");

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting`, {
      method: "GET",
      headers: { Authorization: auth.authorization, Accept: "application/json", ...(storeId ? { "X-Store-Id": storeId } : {}) },
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("abort") || msg.includes("timed out")) return errorJson("TIMEOUT", "Upstream request timed out", 504);
    return errorJson("NETWORK_ERROR", "Failed to reach maintenance service", 502);
  }
}

/** Add a guide to the issue (one per specific problem). */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyJsonPost(request, `${BASE_URL}/issues/${encodeURIComponent(id)}/troubleshooting-guides`);
}
