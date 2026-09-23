import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/store-shirt-milestones
 * Proxy → GET {HIRING}/v1/store-shirt-milestones?storeIds[]=…
 *
 * The store manager's queue across several stores in ONE call — the same
 * pattern as /api/v1/requests. Returns a RAW Laravel paginator at the top
 * level — no `{data:…}` wrapper. Repeated `storeIds[]` / `statuses[]` params
 * are forwarded intact (proxyQuery appends rather than sets).
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyQuery(request, authorization, "/store-shirt-milestones");
}
