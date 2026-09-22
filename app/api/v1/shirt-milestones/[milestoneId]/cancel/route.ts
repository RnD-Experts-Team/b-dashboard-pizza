import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-milestones/[milestoneId]/cancel
 * Proxy → POST {HIRING}/v1/shirt-milestones/{id}/cancel
 *
 * Reachable from pending_entry, submitted or ordered. Body
 * `{ cancellation_reason }` (required). Permanent for that month: the row stays
 * behind so the nightly job never re-creates it.
 */
export async function POST(
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
    `/shirt-milestones/${encodeURIComponent(milestoneId)}/cancel`,
    "POST",
  );
}
