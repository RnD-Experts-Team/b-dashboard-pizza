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

/** POST /api/cleaning/inspection-items — { name, weight? } */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: { name?: unknown; weight?: unknown };
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

  const payload: { name: string; weight?: number } = { name: body.name.trim() };
  if (body.weight != null) {
    const weight = Number(body.weight);
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) {
      return errorResponse("VALIDATION_ERROR", "Weight must be between 1 and 100.", 422, {
        field: "weight",
      });
    }
    payload.weight = Math.round(weight);
  }

  return forwardJson(`${CLEANING_BASE_URL}/inspection-items`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(payload),
  });
}
