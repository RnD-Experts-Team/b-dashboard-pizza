import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  jsonHeaders,
  requireAuthorization,
} from "../../../../../_lib/route-utils";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/** POST /api/cleaning/stores/{storeId}/tasks/{task}/uncomplete — { date } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId, task } = await params;
  if (!ID_RE.test(storeId) || !ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Store id and task id must be numeric.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(
    `${CLEANING_BASE_URL}/stores/${encodeURIComponent(storeId)}/tasks/${encodeURIComponent(
      task
    )}/uncomplete`,
    { method: "POST", headers: jsonHeaders(request), body: JSON.stringify(body) }
  );
}
