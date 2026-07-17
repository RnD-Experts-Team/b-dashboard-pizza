import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthorization,
  getAuthorizationHeader,
  fetchWithTimeout,
  errorResponse,
} from "@/app/api/_lib/auth";

// Same-origin proxy for the PNE LC AI (Lumina) bridge's Gemini-cookie disconnect.
//
// The dashboard's only direct call to the AI bridge is the logout-disconnect.
// Doing it from the browser would be cross-origin (CSP connect-src + bridge
// CORS). Routing it through this Route Handler keeps the browser talking only to
// 'self' and forwards to the bridge server-side, where CORS does not apply — so
// no CSP entry and no bridge-side origin allowlist are needed.
//
// Bridge base URL: server-only `LUMINA_BRIDGE_URL` first (not exposed to the
// browser), then the legacy public var, then the production default.
const LUMINA_BRIDGE_URL =
  process.env.LUMINA_BRIDGE_URL ||
  process.env.NEXT_PUBLIC_LUMINA_BRIDGE ||
  "https://backend.ai.lcportal.cloud";

const TIMEOUT_MS = 15_000;

export async function DELETE(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;
  const authorization = getAuthorizationHeader(request);

  try {
    const upstream = await fetchWithTimeout(
      `${LUMINA_BRIDGE_URL}/api/cookies`,
      {
        method: "DELETE",
        headers: {
          Authorization: authorization as string,
          Accept: "application/json",
          Connection: "close",
        },
      },
      TIMEOUT_MS,
    );

    const text = await upstream.text().catch(() => "");
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return errorResponse("UPSTREAM_ERROR", "Failed to reach the AI bridge", 502);
  }
}
