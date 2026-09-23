import { NextRequest } from "next/server";
import { requireAuthorization, getAuthorizationHeader } from "@/app/api/_lib/auth";
import { proxyQuery } from "@/app/api/_lib/hiring-proxy";

/**
 * GET /api/v1/stores/[storeId]/employees/[employeeId]/shirts
 * Proxy → GET {HIRING}/v1/stores/{storeId}/employees/{employeeId}/shirts
 *
 * The employee's whole shirt history — employee, summary counts and every
 * milestone newest-first. Not paginated. Wraps in `{data:…}`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; employeeId: string }> },
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const authorization = getAuthorizationHeader(request)!;
  const { storeId, employeeId } = await params;

  return proxyQuery(
    request,
    authorization,
    `/stores/${encodeURIComponent(storeId)}/employees/${encodeURIComponent(employeeId)}/shirts`,
  );
}
