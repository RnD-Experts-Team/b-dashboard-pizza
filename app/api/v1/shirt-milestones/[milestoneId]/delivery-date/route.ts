import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * PATCH /api/v1/shirt-milestones/[milestoneId]/delivery-date
 * Proxy → PATCH {HIRING}/v1/shirt-milestones/{id}/delivery-date
 *
 * Reschedules an already-ordered shirt. Body `{ delivery_date }` (required).
 * The status stays `ordered` — this is not a transition. PATCH is the only
 * non-POST write verb in the feature; the upstream rejects POST here.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { milestoneId } = await params;

  return proxyJson(
    request,
    authorization,
    `/shirt-milestones/${encodeURIComponent(milestoneId)}/delivery-date`,
    "PATCH",
  );
}
