import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  jsonHeaders,
  requireAuthorization,
} from "../_lib/route-utils";

export const dynamic = "force-dynamic";

/** GET /api/cleaning/settings — current score formula/shares + explain block */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  return forwardJson(`${CLEANING_BASE_URL}/settings`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/**
 * PUT /api/cleaning/settings — Super Admin only (backend-enforced, 403
 * otherwise). `items_share + chart_share` must equal 100 exactly (422 otherwise).
 */
export async function PUT(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/settings`, {
    method: "PUT",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
