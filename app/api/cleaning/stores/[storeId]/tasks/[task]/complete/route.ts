import { NextRequest } from "next/server";
import {
  CLEANING_BASE_URL,
  errorResponse,
  forwardJson,
  getHeaders,
  requireAuthorization,
} from "../../../../../_lib/route-utils";

export const dynamic = "force-dynamic";

const ID_RE = /^\d+$/;

/**
 * POST /api/cleaning/stores/{storeId}/tasks/{task}/complete
 * multipart/form-data: date, employee_ids[], note?, photo?
 *
 * Rebuilds the upstream FormData and forwards WITHOUT setting Content-Type
 * so fetch generates the multipart boundary.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string; task: string }> }
) {
  const authError = requireAuthorization(request);
  if (authError) return authError;

  const { storeId, task } = await params;
  if (!ID_RE.test(storeId) || !ID_RE.test(task)) {
    return errorResponse("INVALID_PARAM", "Store id and task id must be numeric.", 400);
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return errorResponse("INVALID_PARAM", "Invalid form data in request body.", 400);
  }

  const employeeIds = incoming
    .getAll("employee_ids[]")
    .concat(incoming.getAll("employee_ids"))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  if (employeeIds.length === 0) {
    return errorResponse(
      "VALIDATION_ERROR",
      "At least one employee is required.",
      422,
      { field: "employee_ids" }
    );
  }

  const upstream = new FormData();
  const date = incoming.get("date");
  if (typeof date === "string" && date) upstream.append("date", date);

  for (const id of employeeIds) upstream.append("employee_ids[]", id);

  const note = incoming.get("note");
  if (typeof note === "string" && note.trim()) upstream.append("note", note);

  const photo = incoming.get("photo");
  if (photo instanceof File && photo.size > 0) {
    upstream.append("photo", photo, photo.name || "photo.jpg");
  }

  return forwardJson(
    `${CLEANING_BASE_URL}/stores/${encodeURIComponent(storeId)}/tasks/${encodeURIComponent(
      task
    )}/complete`,
    { method: "POST", headers: getHeaders(request), body: upstream }
  );
}
