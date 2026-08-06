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

/** GET /api/cleaning/inspection-items — list columns */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  return forwardJson(`${CLEANING_BASE_URL}/inspection-items`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/** POST /api/cleaning/inspection-items — { name } */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return errorResponse("VALIDATION_ERROR", "Name is required.", 422, {
      field: "name",
    });
  }

  return forwardJson(`${CLEANING_BASE_URL}/inspection-items`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify({ name: body.name.trim() }),
  });
}
