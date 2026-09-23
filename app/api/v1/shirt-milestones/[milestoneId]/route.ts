import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/shirt-milestones/[milestoneId]
 * Proxy → GET {HIRING}/v1/shirt-milestones/{id}
 *
 * The HQ (store-agnostic) read of one milestone. Wraps in `{data:…}`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { milestoneId } = await params;

  return proxyQuery(
    request,
    authorization,
    `/shirt-milestones/${encodeURIComponent(milestoneId)}`,
  );
}
