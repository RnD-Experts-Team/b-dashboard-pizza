import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../_lib/route-utils";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/**
 * PUT /api/cleaning/inspection-items/{id} — { weight }
 *
 * Weights are snapshotted onto each already-graded cell, so this never
 * re-scores an evaluation that already went out.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionItem: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { inspectionItem } = await params;
  if (!ID_RE.test(inspectionItem)) {
    return errorResponse("INVALID_PARAM", "Inspection item id must be numeric.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid JSON in request body.", 400);
  }

  return forwardJson(
    `${CLEANING_BASE_URL}/inspection-items/${encodeURIComponent(inspectionItem)}`,
    {
      method: "PUT",
      headers: { ...getHeaders(request), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

/** DELETE /api/cleaning/inspection-items/{id} — remove column */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ inspectionItem: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { inspectionItem } = await params;
  if (!ID_RE.test(inspectionItem)) {
    return errorResponse("INVALID_PARAM", "Inspection item id must be numeric.", 400);
  }

  return forwardJson(
    `${CLEANING_BASE_URL}/inspection-items/${encodeURIComponent(inspectionItem)}`,
    { method: "DELETE", headers: getHeaders(request) }
  );
}
