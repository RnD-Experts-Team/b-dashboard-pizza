import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/stores/[storeId]/shirt-milestones/[milestoneId]
 * Proxy → GET {HIRING}/v1/stores/{storeId}/shirt-milestones/{id}
 *
 * 404s when the milestone belongs to a different store. Wraps in `{data:…}`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; milestoneId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, milestoneId } = await params;

  return proxyQuery(
    request,
    authorization,
    `/stores/${encodeURIComponent(storeId)}/shirt-milestones/${encodeURIComponent(milestoneId)}`,
  );
}
