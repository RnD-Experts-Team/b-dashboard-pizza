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
 * POST /api/cleaning/evaluations/allocations/copy
 * { source_store_id, target_store_ids: number[] (max 50), period_type, period_key, dry_run? }
 *
 * Copies the source store's WHOLE saved weight split to each target store.
 * Always send `dry_run: true` first to preview — it's a bulk write across
 * stores and some targets legitimately can't take it (FRONTEND-guide.md §3).
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

  return forwardJson(`${CLEANING_BASE_URL}/evaluations/allocations/copy`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
