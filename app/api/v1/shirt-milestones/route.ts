import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/shirt-milestones
 * Proxy → GET {HIRING}/v1/shirt-milestones
 *
 * The HQ cross-store fulfilment queue. Returns a RAW Laravel paginator at the
 * top level — no `{data:…}` wrapper. Forwards repeated `stores[]` and
 * `statuses[]` params intact (proxyQuery appends rather than sets).
 *
 * Expect 403 until the "Employee Obsession" role is granted on the auth server
 * against the api.v1.shirt-milestones.* route names.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyQuery(request, authorization, "/shirt-milestones");
}
