import { NextRequest } from "next/server";
import {
  errorJson,
  hasUnsafeSegment,
  proxyPassthrough,
  upstreamFromSegments,
} from "@/app/api/maintenance-tickets/_lib/proxy";

type CatchAllContext = { params: Promise<{ path?: string[] }> };

/**
 * Route handlers for one v2 area served by a single catch-all route
 * (`trips/[[...path]]`, `payments/[[...path]]`, …). Every request is checked
 * for an Authorization header (app/api/_lib/auth.ts, via proxyPassthrough)
 * and forwarded as-is to `${BASE_URL}/<upstreamPrefix>/<path>`; the upstream
 * auth rules decide who may do what.
 *
 *   const area = areaHandlers("trips");
 *   export const GET = area.GET; …
 */
export function areaHandlers(upstreamPrefix: string) {
  async function handle(request: NextRequest, ctx: CatchAllContext) {
    const { path } = await ctx.params;
    if (hasUnsafeSegment(path)) {
      return errorJson("INVALID_REQUEST", "Invalid path", 400);
    }
    return proxyPassthrough(request, upstreamFromSegments(request, upstreamPrefix, path));
  }
  return { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle };
}

/** Same, for a fixed path with no catch-all segment. */
export function fixedHandlers(upstreamPath: string) {
  async function handle(request: NextRequest) {
    return proxyPassthrough(request, upstreamFromSegments(request, upstreamPath, []));
  }
  return { GET: handle, POST: handle, PATCH: handle, PUT: handle, DELETE: handle };
}
