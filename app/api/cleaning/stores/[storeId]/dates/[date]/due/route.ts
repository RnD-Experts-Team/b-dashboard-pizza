import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../../../../_lib/route-utils";

export const dynamic = "force-dynamic";

const STORE_ID_RE = /^\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/cleaning/stores/{storeId}/dates/{date}/due — what's due + employees */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; date: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId, date } = await params;
  if (!STORE_ID_RE.test(storeId)) {
    return errorResponse("INVALID_PARAM", "Store id must be numeric.", 400);
  }
  if (!DATE_RE.test(date)) {
    return errorResponse("INVALID_PARAM", "Date must be YYYY-MM-DD.", 400);
  }

  return forwardJson(
    `${CLEANING_BASE_URL}/stores/${encodeURIComponent(storeId)}/dates/${encodeURIComponent(
      date
    )}/due`,
    { method: "GET", headers: getHeaders(request) }
  );
}
