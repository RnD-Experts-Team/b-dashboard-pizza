import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/cleaning/periods?type=week|date&around=YYYY-MM-DD&span=4
 *
 * The only legitimate source of period keys/labels — see the migration
 * guide §4: a locally-generated ISO-week key silently diverges from the
 * backend's accounting-calendar week numbering on 2026-12-29.
 */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/periods${search}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}
