import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/shirt-catalog
 * Proxy → GET {HIRING}/v1/shirt-catalog
 *
 * The ONLY catalog read — returns `{ data: { colors, logos, templates } }`.
 * Active rows only unless `?include_inactive=1`, which the admin screen sends
 * so retired entries can be shown greyed out rather than vanishing.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;

  return proxyQuery(request, authorization, "/shirt-catalog");
}
