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

/** GET /api/cleaning/tasks — list task definitions */
export async function GET(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const search = request.nextUrl.search;
  return forwardJson(`${CLEANING_BASE_URL}/tasks${search}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/** POST /api/cleaning/tasks — create a task + rule */
export async function POST(request: NextRequest) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/tasks`, {
    method: "POST",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}
