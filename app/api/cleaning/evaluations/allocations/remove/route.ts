import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  jsonHeaders,
  requireAuthorization,
} from "../../../_lib/route-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/cleaning/evaluations/allocations/remove
 * { store_ids: number[] (1-50, no duplicates), period_type, period_key,
 *   source_task_ids?: number[], dry_run? }
 *
 * The undo for the copy endpoint: clears saved weight splits from many
 * stores in one call. Omitting `source_task_ids` clears every split those
 * stores have for the period. Always send `dry_run: true` first — this moves
 * the chart score on every store it touches and nothing restores the old
 * distribution afterwards (remove-button guide §1-3).
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

  return forwardJson(`${CLEANING_BASE_URL}/evaluations/allocations/remove`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
