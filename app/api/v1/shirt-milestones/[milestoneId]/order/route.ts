import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyJson } from "@/app/api/_lib/hiring-proxy";

/**
 * POST /api/v1/shirt-milestones/[milestoneId]/order
 * Proxy → POST {HIRING}/v1/shirt-milestones/{id}/order
 *
 * submitted → ordered. Body `{ delivery_date }` (required, plain YYYY-MM-DD).
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
    `/shirt-milestones/${encodeURIComponent(milestoneId)}/order`,
    "POST",
  );
}
