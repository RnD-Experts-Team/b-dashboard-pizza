import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../../_lib/route-utils";

export const dynamic = "force-dynamic";

const STORE_ID_RE = /^\d+$/;

/** GET /api/cleaning/stores/{storeId}/due-range?from=&to= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId } = await params;
  if (!STORE_ID_RE.test(storeId)) {
    return errorResponse("INVALID_PARAM", "Store id must be numeric.", 400);
  }

  const search = request.nextUrl.search;
  return forwardJson(
    `${CLEANING_BASE_URL}/stores/${encodeURIComponent(storeId)}/due-range${search}`,
    { method: "GET", headers: getHeaders(request) }
  );
}
