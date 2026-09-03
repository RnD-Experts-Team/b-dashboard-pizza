import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  jsonHeaders,
  requireAuthorization,
} from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/cleaning/evaluations/allocations?store_id=&period_type=&period_key= */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/evaluations/allocations${search}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/**
 * POST /api/cleaning/evaluations/allocations
 * { store_id, period_type, period_key, source_task_id, amounts: [{target_task_id, amount}] }
 *
 * Replaces the ENTIRE split for one `source_task_id` in a single transaction —
 * amounts must sum to the source task's weight exactly (422 otherwise), a
 * partial split is rejected rather than stored.
 */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/evaluations/allocations`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}

/** DELETE /api/cleaning/evaluations/allocations?store_id=&period_type=&period_key=&source_task_id= */
export async function DELETE(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/evaluations/allocations${search}`, {
    method: "DELETE",
    headers: getHeaders(request),
  });
}
