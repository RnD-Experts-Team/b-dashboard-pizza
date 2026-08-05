import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../../../../_lib/route-utils";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/** GET /api/cleaning/stores/{storeId}/tasks/{task}/history?from=&to= */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId, task } = await params;
  if (!ID_RE.test(storeId) || !ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Store id and task id must be numeric.", 400);
  }

  const search = request.nextUrl.search;
  return forwardJson(
    `${CLEANING_BASE_URL}/stores/${encodeURIComponent(storeId)}/tasks/${encodeURIComponent(
      task
    )}/history${search}`,
    { method: "GET", headers: getHeaders(request) }
  );
}
