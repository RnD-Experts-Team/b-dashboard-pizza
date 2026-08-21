import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/cleaning/reports/data?period_type=&period_key= — JSON grid for reports */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/reports/data${search}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}
