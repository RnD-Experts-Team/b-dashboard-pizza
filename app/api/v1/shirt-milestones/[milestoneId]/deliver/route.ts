import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-milestones/[milestoneId]/deliver
 * Proxy → POST {HIRING}/v1/shirt-milestones/{id}/deliver
 *
 * ordered → delivered (terminal). Body `{ delivery_notes }` is optional, so the
 * body may legitimately be empty — proxyJson reads text() for that reason.
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
    `/shirt-milestones/${encodeURIComponent(milestoneId)}/deliver`,
    "POST",
  );
}
