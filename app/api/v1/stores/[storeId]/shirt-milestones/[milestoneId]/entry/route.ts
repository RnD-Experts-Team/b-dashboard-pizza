import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/stores/[storeId]/shirt-milestones/[milestoneId]/entry
 * Proxy → POST {HIRING}/v1/stores/{storeId}/shirt-milestones/{id}/entry
 *
 * Fills the entry form: pending_entry → submitted. Only valid from
 * `pending_entry`; anything else throws upstream and surfaces as a 500.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; milestoneId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, milestoneId } = await params;

  return proxyJson(
    request,
    authorization,
    `/stores/${encodeURIComponent(storeId)}/shirt-milestones/${encodeURIComponent(milestoneId)}/entry`,
    "POST",
  );
}
