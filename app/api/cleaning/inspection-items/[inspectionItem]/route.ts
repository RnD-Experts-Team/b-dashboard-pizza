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
