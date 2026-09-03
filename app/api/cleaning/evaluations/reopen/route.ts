import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  jsonHeaders,
  requireAuthorization,
} from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/cleaning/evaluations/reopen — { store_id, period_type, period_key }
 *
 * Super Admin only (backend-enforced, 403 otherwise). Clears the finalize
 * lock and discards the frozen scores, returning the evaluation to live
 * computation.
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

  return forwardJson(`${CLEANING_BASE_URL}/evaluations/reopen`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
