import { NextRequest, NextResponse } from "next/server";
import {
  BASE_URL,
  errorJson,
  hasUnsafeSegment,
  proxyPassthrough,
} from "@/app/api/maintenance-tickets/_lib/proxy";
import { checkRateLimit, getClientIp } from "@/app/api/_lib/rate-limit";

type Params = { params: Promise<{ token: string; path?: string[] }> };

/**
 * The technician's trip page (`/[locale]/trip/[token]`) — NO dashboard login.
 * The token in the path is the only credential, so no Authorization header is
 * read or forwarded. Forwards to `${BASE_URL}/public/trips/{token}/…`
 * (MAINTENANCE §3 "Public endpoints"): 404 unknown token, 410 expired.
 *
 * Rate-limited here as well as upstream (60/min), per client and token, so a
 * guessed-token scan is slowed before it reaches the service.
 */
const LIMIT = { max: 60, windowMs: 60_000 };

async function handle(request: NextRequest, { params }: Params) {
  const { token, path } = await params;
  if (!token || hasUnsafeSegment([token]) || hasUnsafeSegment(path)) {
    return errorJson("INVALID_REQUEST", "Invalid trip link", 400);
  }

  const limit = checkRateLimit(`public-trip:${getClientIp(request)}:${token}`, LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { message: "Too many requests. Wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSeconds ?? 60),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const rest = (path ?? []).map(encodeURIComponent).join("/");
  const qs = new URL(request.url).search;
  const upstream = `${BASE_URL}/public/trips/${encodeURIComponent(token)}${rest ? `/${rest}` : ""}${qs}`;
  return proxyPassthrough(request, upstream, { auth: false });
}

export const GET = handle;
export const POST = handle;
