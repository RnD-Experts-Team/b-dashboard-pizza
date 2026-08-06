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

const ID_RE = /^\d+$/;

/** GET /api/cleaning/tasks/{task} — one task */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { task } = await params;
  if (!ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Task id must be numeric.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/tasks/${encodeURIComponent(task)}`, {
    method: "GET",
    headers: getHeaders(request),
  });
}

/** PUT /api/cleaning/tasks/{task} — update; send only changed fields */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { task } = await params;
  if (!ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Task id must be numeric.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/tasks/${encodeURIComponent(task)}`, {
    method: "PUT",
    headers: jsonHeaders(request),
    body: JSON.stringify(body),
  });
}

/** DELETE /api/cleaning/tasks/{task} — soft delete (removed from Due; history kept) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { task } = await params;
  if (!ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Task id must be numeric.", 400);
  }

  return forwardJson(`${CLEANING_BASE_URL}/tasks/${encodeURIComponent(task)}`, {
    method: "DELETE",
    headers: getHeaders(request),
  });
}
