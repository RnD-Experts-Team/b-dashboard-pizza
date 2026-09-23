import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery, proxyJson } from "@/app/api/_lib/hiring-proxy";

/** `storeId` here is the store NUMBER string (e.g. "03759-00001"), not the PK. */
function path(storeId: string) {
  return `/stores/${encodeURIComponent(storeId)}/shirt-milestones`;
}

/**
 * GET /api/v1/stores/[storeId]/shirt-milestones
 * Proxy → GET {HIRING}/v1/stores/{storeId}/shirt-milestones
 *
 * Returns a RAW Laravel paginator at the top level — no `{data:…}` wrapper.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId } = await params;

  return proxyQuery(request, authorization, path(storeId));
}

/**
 * POST /api/v1/stores/[storeId]/shirt-milestones
 * Manual create + fill in one call — lands directly in `submitted`, returns 201.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId } = await params;

  return proxyJson(request, authorization, path(storeId), "POST");
}
